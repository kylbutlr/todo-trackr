import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  cancelTaskAlarm,
  scheduleTaskAlarm,
  type AlarmTriggerClient,
} from "../netlify/functions/lib/task-alarm-trigger.js";
import { updateTaskSchema } from "../netlify/functions/lib/tasks.js";

describe("Task Attention Alarms", () => {
  it("accepts scheduling, removing, and clearing an alarm", () => {
    expect(updateTaskSchema.parse({ alarmAt: "2026-08-28T09:30:00-07:00" })).toEqual({
      alarmAt: "2026-08-28T09:30:00-07:00",
    });
    expect(updateTaskSchema.parse({ alarmAt: null })).toEqual({ alarmAt: null });
    expect(updateTaskSchema.parse({ clearAlarm: true })).toEqual({ clearAlarm: true });
  });

  it("keeps alarm acknowledgement separate from scheduling", () => {
    expect(() => updateTaskSchema.parse({
      alarmAt: "2026-08-28T09:30:00-07:00",
      clearAlarm: true,
    })).toThrow("Set or clear an alarm in one action, not both.");
    expect(() => updateTaskSchema.parse({ clearAlarm: false })).toThrow();
  });

  it("uses native and delayed notifications without a one-minute Neon scan", () => {
    const scheduled = new URL("../netlify/functions/task-alarms-scheduled.mts", import.meta.url);
    const alarms = readFileSync(
      new URL("../netlify/functions/lib/task-alarms.ts", import.meta.url),
      "utf8",
    );
    const nativeAlarms = readFileSync(
      new URL("../apps/macos/Sources/Services/TaskAlarmNotificationService.swift", import.meta.url),
      "utf8",
    );
    const triggerTask = readFileSync(
      new URL("../src/trigger/task-alarm.ts", import.meta.url),
      "utf8",
    );
    expect(existsSync(scheduled)).toBe(false);
    expect(nativeAlarms).toContain("UNTimeIntervalNotificationTrigger");
    expect(nativeAlarms).toContain("await schedule(task: task, at: alarmAt)");
    expect(triggerTask).toContain('id: "deliver-task-alarm"');
    expect(triggerTask).toContain("TODO_TRACKR_TRIGGER_CALLBACK_URL");
    expect(triggerTask).toContain("TODO_TRACKR_INGEST_TOKEN");
    expect(alarms).toContain("WHERE id = ${taskId}");
    expect(alarms).toContain("alarm_at = ${expectedAlarmAt}");
    expect(alarms).toContain("alarm_notified_at IS NULL");
    expect(alarms).toContain("alarm_cleared_at IS NULL");
  });

  it("schedules one delayed run and can cancel the stored run", async () => {
    const events: string[] = [];
    const client: AlarmTriggerClient = {
      trigger: async (taskId, alarmAt) => {
        events.push(`trigger:${taskId}:${alarmAt}`);
        return "run_123";
      },
      cancel: async (runId) => {
        events.push(`cancel:${runId}`);
      },
    };

    await expect(scheduleTaskAlarm(
      "6b235c9d-07d0-4572-80a4-159f68688198",
      "2026-08-28T16:30:00.000Z",
      client,
    )).resolves.toBe("run_123");
    await cancelTaskAlarm("run_123", client);
    expect(events).toEqual([
      "trigger:6b235c9d-07d0-4572-80a4-159f68688198:2026-08-28T16:30:00.000Z",
      "cancel:run_123",
    ]);
  });
});

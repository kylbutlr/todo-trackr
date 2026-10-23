import { runs, tasks } from "@trigger.dev/sdk";
import { isStandalone } from "./installation.js";

import type { deliverTaskAlarm } from "../../../src/trigger/task-alarm.js";

export type AlarmTriggerClient = {
  trigger: (taskId: string, alarmAt: string) => Promise<string>;
  cancel: (runId: string) => Promise<void>;
};

const triggerClient: AlarmTriggerClient = {
  trigger: async (taskId, alarmAt) => {
    const handle = await tasks.trigger<typeof deliverTaskAlarm>(
      "deliver-task-alarm",
      { taskId, alarmAt },
      { delay: new Date(alarmAt) },
    );
    return handle.id;
  },
  cancel: async (runId) => {
    await runs.cancel(runId);
  },
};

export async function scheduleTaskAlarm(
  taskId: string,
  alarmAt: string,
  client: AlarmTriggerClient = triggerClient,
): Promise<string> {
  if (client === triggerClient && isStandalone()) return `local:${taskId}:${alarmAt}`;
  return await client.trigger(taskId, alarmAt);
}

export async function cancelTaskAlarm(
  runId: string | null,
  client: AlarmTriggerClient = triggerClient,
): Promise<void> {
  if (!runId) return;
  if (runId.startsWith("local:")) return;
  try {
    await client.cancel(runId);
  } catch (error) {
    console.warn("Unable to cancel stale Trigger.dev alarm run", { runId, error });
  }
}

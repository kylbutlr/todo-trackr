import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../apps/web/src/api.js";
import {
  draftFromTask,
  reconcileTaskDraft,
} from "../apps/web/src/taskDraft.js";
import type { Task } from "../apps/web/src/types.js";

function task(id: string, title: string, updatedAt = "2026-08-16T12:00:00Z"): Task {
  return {
    id,
    title,
    notes: "",
    status: "open",
    priority: "none",
    dueAt: null,
    sortOrder: 0,
    createdAt: "2026-08-16T12:00:00Z",
    updatedAt,
    completedAt: null,
    archivedAt: null,
    isStarred: false,
    listId: "00000000-0000-4000-8000-000000000001",
    source: "manual",
    sourceUrl: null,
    sourceDetails: null,
  };
}

describe("Task editor draft", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves WIP edits when polling refreshes the same Task", () => {
    const selected = task("task-one", "Original title");
    const draft = { ...draftFromTask(selected), dirty: true, title: "Unfinished WIP title" };
    const refreshed = task("task-one", "Original title", "2026-08-16T12:00:30Z");

    expect(reconcileTaskDraft(draft, refreshed).title).toBe("Unfinished WIP title");
  });

  it("accepts server refreshes when the editor has no WIP changes", () => {
    const draft = draftFromTask(task("task-one", "Original title"));

    expect(reconcileTaskDraft(draft, task("task-one", "Updated elsewhere")).title).toBe("Updated elsewhere");
  });

  it("loads a fresh draft when a different Task is selected", () => {
    const draft = { ...draftFromTask(task("task-one", "First")), dirty: true, title: "WIP" };

    expect(reconcileTaskDraft(draft, task("task-two", "Second"))).toMatchObject({
      taskId: "task-two",
      title: "Second",
    });
  });

  it("does not repopulate an alarm after it is cleared", () => {
    const cleared = {
      ...task("task-one", "Follow up"),
      alarmAt: "2026-08-28T16:30:00Z",
      alarmClearedAt: "2026-08-28T16:35:00Z",
    };

    expect(draftFromTask(cleared).alarmAt).toBe("");
  });

  it("uses native form submission so Enter invokes Save changes", () => {
    const source = readFileSync(new URL("../apps/web/src/App.tsx", import.meta.url), "utf8");

    expect(source).toContain('<form className="detail-panel" onSubmit={submit}>');
    expect(source).toContain('<button className="primary-button detail-save" disabled={!title.trim() || saving} type="submit">');
  });

  it("sends the observed Task version and preserves drafts after a conflict", () => {
    const application = readFileSync(new URL("../apps/web/src/App.tsx", import.meta.url), "utf8");
    const client = readFileSync(new URL("../apps/web/src/api.ts", import.meta.url), "utf8");
    const server = readFileSync(new URL("../netlify/functions/lib/tasks.ts", import.meta.url), "utf8");

    expect(client).toContain("expectedUpdatedAt: task.updateToken ?? task.updatedAt");
    expect(application).toContain('caught.code === "TASK_CONFLICT"');
    expect(server).toContain("updated_at = ${input.expectedUpdatedAt");
    expect(server).toContain('code: "TASK_CONFLICT"');
  });

  it("retries a one-click completion against the latest server version", async () => {
    const stale = {
      ...task("browser-task", "Captured browser task", "2026-08-16T12:00:00Z"),
      source: "browser" as const,
      sourceUrl: "https://example.com/captured-page",
    };
    const current = {
      ...stale,
      updatedAt: "2026-08-16T12:01:00Z",
    };
    const completed = {
      ...current,
      status: "completed" as const,
      completedAt: "2026-08-16T12:02:00Z",
      updatedAt: "2026-08-16T12:02:00Z",
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: "This Task changed elsewhere. Your edits are still here.",
        code: "TASK_CONFLICT",
        currentTask: current,
      }), { status: 409, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ task: completed }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.updateTask(stale, { status: "completed" })).resolves.toEqual(completed);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toEqual({
      status: "completed",
      expectedUpdatedAt: current.updatedAt,
    });
  });

  it("retries a one-click Starred change against the latest server version", async () => {
    const stale = task("shortcut-task", "Shortcut task", "2026-08-16T12:00:00Z");
    const current = { ...stale, source: "shortcut" as const, updatedAt: "2026-08-16T12:01:00Z" };
    const starred = { ...current, isStarred: true, updatedAt: "2026-08-16T12:02:00Z" };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: "This Task changed elsewhere. Your edits are still here.",
        code: "TASK_CONFLICT",
        currentTask: current,
      }), { status: 409, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ task: starred }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.updateTask(stale, { isStarred: true })).resolves.toEqual(starred);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toEqual({
      isStarred: true,
      expectedUpdatedAt: current.updatedAt,
    });
  });

  it("does not retry editable-field conflicts that need user review", async () => {
    const stale = task("manual-task", "Original title", "2026-08-16T12:00:00Z");
    const current = task("manual-task", "Changed on another device", "2026-08-16T12:01:00Z");
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      error: "This Task changed elsewhere. Your edits are still here.",
      code: "TASK_CONFLICT",
      currentTask: current,
    }), { status: 409, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.updateTask(stale, { title: "My WIP edit" })).rejects.toMatchObject({
      code: "TASK_CONFLICT",
      currentTask: current,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

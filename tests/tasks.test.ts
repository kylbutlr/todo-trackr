import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  assertTaskUpdateAllowed,
  createTaskSchema,
  updateTaskSchema,
} from "../netlify/functions/lib/tasks.js";
import { createListSchema, INBOX_LIST_ID } from "../netlify/functions/lib/lists.js";

describe("task validation", () => {
  it("executes the reusable Task column list as SQL when loading one Task", () => {
    const persistence = readFileSync(
      new URL("../netlify/functions/lib/tasks.ts", import.meta.url),
      "utf8",
    );

    expect(persistence).toMatch(
      /async function taskRow[\s\S]*?sql\.query\(\s*`[\s\S]*?WHERE tasks\.id = \$1[\s\S]*?\[id\][\s\S]*?\)/u,
    );
  });

  it("preserves PostgreSQL microseconds in the optimistic-lock timestamp", () => {
    const persistence = readFileSync(
      new URL("../netlify/functions/lib/tasks.ts", import.meta.url),
      "utf8",
    );

    expect(new Date("2026-08-16T12:00:00.123456Z").toISOString()).toBe(
      "2026-08-16T12:00:00.123Z",
    );
    expect(persistence).toContain(
      `to_char(\n    tasks.updated_at AT TIME ZONE 'UTC',\n    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'\n  ) AS updated_at`,
    );
    expect(updateTaskSchema.parse({
      status: "completed",
      expectedUpdatedAt: "2026-08-16T12:00:00.123456Z",
    })).toMatchObject({
      expectedUpdatedAt: "2026-08-16T12:00:00.123456Z",
    });
  });

  it("normalizes a minimal new task", () => {
    expect(createTaskSchema.parse({ title: "  Follow up  " })).toEqual({
      title: "Follow up",
      notes: "",
      priority: "none",
      dueAt: null,
      listId: INBOX_LIST_ID,
      source: "manual",
      sourceUrl: null,
    });
  });

  it("normalizes a list name", () => {
    expect(createListSchema.parse({ name: "  Client work  " })).toEqual({
      name: "Client work",
    });
  });

  it("rejects an empty title", () => {
    expect(() => createTaskSchema.parse({ title: "   " })).toThrow();
  });

  it("requires at least one update field", () => {
    expect(() => updateTaskSchema.parse({})).toThrow();
    expect(() => updateTaskSchema.parse({ expectedUpdatedAt: "2026-08-16T09:00:00-07:00" })).toThrow();
  });

  it("accepts an optimistic edit timestamp alongside a change", () => {
    expect(updateTaskSchema.parse({
      title: "Updated title",
      expectedUpdatedAt: "2026-08-16T09:00:00-07:00",
    })).toEqual({
      title: "Updated title",
      expectedUpdatedAt: "2026-08-16T09:00:00-07:00",
    });
  });

  it("accepts a local Starred update", () => {
    expect(updateTaskSchema.parse({ isStarred: true })).toEqual({ isStarred: true });
  });

  it("accepts a due date with an explicit offset", () => {
    expect(
      updateTaskSchema.parse({ dueAt: "2026-08-16T09:00:00-07:00" }),
    ).toEqual({ dueAt: "2026-08-16T09:00:00-07:00" });
  });

  it("preserves the full Priority scale", () => {
    expect(createTaskSchema.parse({ title: "Urgent", priority: "highest" }).priority).toBe("highest");
    expect(createTaskSchema.parse({ title: "Optional", priority: "lowest" }).priority).toBe("lowest");
  });

  it("accepts a browser Quick Capture with its page URL", () => {
    expect(createTaskSchema.parse({
      title: "Review this requirement",
      source: "browser",
      sourceUrl: "https://example.com/requirements",
    })).toMatchObject({
      source: "browser",
      sourceUrl: "https://example.com/requirements",
    });
  });

  it("rejects a browser Quick Capture without its source URL", () => {
    expect(() => createTaskSchema.parse({
      title: "Review this requirement",
      source: "browser",
    })).toThrow();
  });

  it("accepts a Slack Quick Capture with its message or conversation URL", () => {
    expect(createTaskSchema.parse({
      title: "Reply to this message",
      source: "slack",
      sourceUrl: "https://app.slack.com/client/T123/C456/thread/C456-123",
    })).toMatchObject({
      source: "slack",
      sourceUrl: "https://app.slack.com/client/T123/C456/thread/C456-123",
    });
  });

  it("accepts a native Slack Quick Capture without a message URL", () => {
    expect(createTaskSchema.parse({
      title: "Reply to this message",
      source: "slack",
    })).toMatchObject({
      source: "slack",
      sourceUrl: null,
    });
  });

  it("rejects a browser source URL outside HTTP and HTTPS", () => {
    expect(() => createTaskSchema.parse({
      title: "Unsafe capture",
      source: "browser",
      sourceUrl: "javascript:alert(1)",
    })).toThrow();
  });

  it("allows local List, Notes, and Starred edits for Shortcut-managed Tasks", () => {
    expect(() => assertTaskUpdateAllowed("shortcut", {
      notes: "Remember to verify staging.",
      listId: "00000000-0000-4000-8000-000000000002",
      isStarred: true,
      alarmAt: "2026-08-28T09:30:00-07:00",
    })).not.toThrow();
    expect(() => assertTaskUpdateAllowed("shortcut", { status: "completed" })).toThrow(
      "Shortcut controls this Task's title, lifecycle, priority, and due date.",
    );
  });
});

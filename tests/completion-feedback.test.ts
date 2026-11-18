import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  COMPLETION_EXIT_MS,
  COMPLETION_HOLD_MS,
  preservePendingCompletions,
} from "../apps/web/src/completionFeedback.js";
import type { Task } from "../apps/web/src/types.js";

function task(status: Task["status"]): Task {
  return {
    id: "task-one",
    title: "Finish the animation",
    notes: "",
    status,
    priority: "none",
    dueAt: null,
    sortOrder: 0,
    createdAt: "2026-08-16T12:00:00Z",
    updatedAt: "2026-08-16T12:00:00Z",
    completedAt: status === "completed" ? "2026-08-16T12:01:00Z" : null,
    archivedAt: null,
    isStarred: false,
    listId: "00000000-0000-4000-8000-000000000001",
    source: "manual",
    sourceUrl: null,
    sourceDetails: null,
  };
}

describe("completion feedback", () => {
  it("holds successful completion feedback for one second before exiting", () => {
    expect(COMPLETION_HOLD_MS).toBe(1_000);
    expect(COMPLETION_EXIT_MS).toBeGreaterThanOrEqual(180);
    expect(COMPLETION_EXIT_MS).toBeLessThanOrEqual(300);
  });

  it("preserves the open Task snapshot while its completion animation is pending", () => {
    const current = task("open");
    const refreshed = task("completed");

    expect(preservePendingCompletions([current], [refreshed], new Set([current.id]))).toEqual([current]);
    expect(preservePendingCompletions([current], [refreshed], new Set())).toEqual([refreshed]);
  });

  it("implements matching pending and exit phases in the macOS client", () => {
    const store = readFileSync(new URL("../apps/macos/Sources/Stores/TaskStore.swift", import.meta.url), "utf8");
    const list = readFileSync(new URL("../apps/macos/Sources/Views/TaskListView.swift", import.meta.url), "utf8");

    expect(store).toContain("enum CompletionFeedbackPhase");
    expect(store).toContain("Task.sleep(for: .seconds(1))");
    expect(list).toContain("completionFeedbackPhase");
    expect(list).toContain(".opacity(completionFeedbackPhase == .exiting ? 0 : 1)");
  });
});

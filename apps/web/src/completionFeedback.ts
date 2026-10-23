import type { Task } from "./types.js";

export const COMPLETION_HOLD_MS = 1_000;
export const COMPLETION_EXIT_MS = 220;

export type CompletionFeedbackPhase = "confirming" | "exiting";

export function preservePendingCompletions(
  currentTasks: Task[],
  refreshedTasks: Task[],
  pendingTaskIds: ReadonlySet<string>,
): Task[] {
  if (pendingTaskIds.size === 0) return refreshedTasks;

  const currentById = new Map(currentTasks.map((task) => [task.id, task]));
  return refreshedTasks.map((task) => pendingTaskIds.has(task.id)
    ? currentById.get(task.id) ?? task
    : task);
}

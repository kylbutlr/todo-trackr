import type { Task, TaskPriority } from "./types.js";

export type TaskDraft = {
  taskId: string;
  dirty: boolean;
  title: string;
  notes: string;
  priority: TaskPriority;
  dueAt: string;
  alarmAt: string;
  listId: string;
};

export function toLocalDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function draftFromTask(task: Task): TaskDraft {
  return {
    taskId: task.id,
    dirty: false,
    title: task.title,
    notes: task.notes,
    priority: task.priority,
    dueAt: toLocalDateTime(task.dueAt),
    alarmAt: toLocalDateTime(task.alarmClearedAt ? null : task.alarmAt ?? null),
    listId: task.listId,
  };
}

export function reconcileTaskDraft(current: TaskDraft, incoming: Task): TaskDraft {
  return current.taskId === incoming.id && current.dirty ? current : draftFromTask(incoming);
}

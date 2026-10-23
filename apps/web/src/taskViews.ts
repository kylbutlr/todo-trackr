import type { Task, TaskPriority } from "./types.js";
import { compareShortcutWorkflowStatesDescending } from "./shortcutWorkflowOrder.js";

export type SmartView = "inbox" | "today" | "upcoming" | "overdue" | "all" | "starred" | "recent" | "completed" | "archived";
export type TaskView = SmartView | `list:${string}` | `source:${"shortcut" | "granola" | "slack"}`;
export type SortMode = "smart" | "due" | "priority" | "newest";
export type DueFilter = "any" | "overdue" | "today" | "upcoming" | "none";

export type TaskQuery = {
  search: string;
  priority: "any" | TaskPriority;
  due: DueFilter;
  sort: SortMode;
};

function startOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfTomorrow(now: Date): Date {
  const value = startOfToday(now);
  value.setDate(value.getDate() + 1);
  return value;
}

function dueTime(task: Task): number | undefined {
  return task.dueAt ? new Date(task.dueAt).getTime() : undefined;
}

export function dueState(task: Task, now = new Date()): "overdue" | "today" | "upcoming" | "none" {
  const due = dueTime(task);
  if (due === undefined) return "none";
  if (due < startOfToday(now).getTime()) return "overdue";
  if (due < startOfTomorrow(now).getTime()) return "today";
  return "upcoming";
}

export function tasksForView(tasks: Task[], view: TaskView, inboxId: string, now = new Date()): Task[] {
  if (view.startsWith("list:")) {
    const listId = view.slice(5);
    return tasks.filter((task) => task.listId === listId && task.status === "open");
  }

  if (view.startsWith("source:")) {
    const source = view.slice(7);
    return tasks.filter((task) => task.source === source && task.status === "open");
  }

  return tasks.filter((task) => {
    switch (view) {
      case "inbox": return task.listId === inboxId && task.status === "open";
      case "today": return task.status === "open" && dueState(task, now) === "today";
      case "upcoming": return task.status === "open" && dueState(task, now) === "upcoming";
      case "overdue": return task.status === "open" && dueState(task, now) === "overdue";
      case "all": return task.status === "open";
      case "starred": return task.status === "open" && task.isStarred;
      case "recent": return true;
      case "completed": return task.status === "completed";
      case "archived": return task.status === "archived";
    }
  });
}

const priorityRank: Record<TaskPriority, number> = {
  highest: 0,
  high: 1,
  medium: 2,
  low: 3,
  lowest: 4,
  none: 5,
};
const dueRank = { overdue: 0, today: 1, upcoming: 2, none: 3 } as const;

function compareShortcutTaskIDs(left: Task, right: Task): number {
  // Refresh timestamps are not a stable order for imported Shortcut work.
  if (left.source !== "shortcut" || right.source !== "shortcut") return 0;
  const leftReference = left.sourceDetails?.externalReference.trim() ?? "";
  const rightReference = right.sourceDetails?.externalReference.trim() ?? "";
  if (!leftReference || !rightReference) return 0;

  const leftID = Number(leftReference);
  const rightID = Number(rightReference);
  if (Number.isSafeInteger(leftID) && Number.isSafeInteger(rightID) && leftID !== rightID) {
    return leftID - rightID;
  }
  return leftReference.localeCompare(rightReference);
}

function compareCreatedAt(left: Task, right: Task): number {
  return Date.parse(right.createdAt) - Date.parse(left.createdAt);
}

function compareStableTaskIDs(left: Task, right: Task): number {
  return compareShortcutTaskIDs(left, right) || left.id.localeCompare(right.id);
}

export function queryTasks(tasks: Task[], query: TaskQuery, now = new Date()): Task[] {
  const needle = query.search.trim().toLocaleLowerCase();
  const filtered = tasks.filter((task) => {
    if (needle && !`${task.title}\n${task.notes}`.toLocaleLowerCase().includes(needle)) return false;
    if (query.priority !== "any" && task.priority !== query.priority) return false;
    if (query.due !== "any" && dueState(task, now) !== query.due) return false;
    return true;
  });

  return filtered.toSorted((left, right) => {
    if (query.sort === "newest") return compareCreatedAt(left, right) || compareStableTaskIDs(left, right);
    if (query.sort === "priority") {
      return priorityRank[left.priority] - priorityRank[right.priority]
        || (dueTime(left) ?? Infinity) - (dueTime(right) ?? Infinity)
        || compareStableTaskIDs(left, right);
    }
    if (query.sort === "due") {
      return (dueTime(left) ?? Infinity) - (dueTime(right) ?? Infinity)
        || priorityRank[left.priority] - priorityRank[right.priority]
        || compareStableTaskIDs(left, right);
    }

    const leftDueState = dueState(left, now);
    const rightDueState = dueState(right, now);
    const stateDifference = dueRank[leftDueState] - dueRank[rightDueState];
    if (stateDifference !== 0) return stateDifference;

    if (leftDueState === "upcoming") {
      return (dueTime(left) ?? Infinity) - (dueTime(right) ?? Infinity)
        || Number(right.isStarred) - Number(left.isStarred)
        || priorityRank[left.priority] - priorityRank[right.priority]
        || compareShortcutTaskIDs(left, right)
        || compareCreatedAt(left, right)
        || left.id.localeCompare(right.id);
    }

    return Number(right.isStarred) - Number(left.isStarred)
      || priorityRank[left.priority] - priorityRank[right.priority]
      || (dueTime(left) ?? Infinity) - (dueTime(right) ?? Infinity)
      || compareShortcutTaskIDs(left, right)
      || compareCreatedAt(left, right)
      || left.id.localeCompare(right.id);
  });
}

export type TaskSection = {
  id: string;
  label: string | null;
  tasks: Task[];
};

function addDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function calendarKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function taskSections(tasks: Task[], view: TaskView, now = new Date()): TaskSection[] {
  if (view === "completed" || view === "archived") {
    return [{ id: "tasks", label: null, tasks }];
  }

  if (view === "recent") {
    const sorted = tasks.toSorted((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    const today = startOfToday(now);
    const yesterdayKey = calendarKey(addDays(today, -1));
    const todayKey = calendarKey(today);
    const groups = new Map<string, TaskSection>();
    for (const task of sorted) {
      const created = new Date(task.createdAt);
      const id = calendarKey(created);
      const label = id === todayKey
        ? "Today"
        : id === yesterdayKey
          ? "Yesterday"
          : new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(created);
      const group = groups.get(id) ?? { id, label, tasks: [] };
      group.tasks.push(task);
      groups.set(id, group);
    }
    return [...groups.values()];
  }

  const today = startOfToday(now);
  const tomorrow = addDays(today, 1);
  const afterTomorrow = addDays(today, 2);
  const laterBoundary = addDays(today, 7);
  const groups = new Map<string, TaskSection>();
  for (const task of tasks) {
    const due = task.dueAt ? new Date(task.dueAt) : null;
    let id: string;
    let label: string;
    if (!due) {
      id = "undated";
      label = "No due date";
    } else if (due < today) {
      id = "overdue";
      label = "Overdue";
    } else if (due < tomorrow) {
      id = "today";
      label = "Today";
    } else if (due < afterTomorrow) {
      id = "tomorrow";
      label = "Tomorrow";
    } else if (due < laterBoundary) {
      id = calendarKey(due);
      label = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(due);
    } else {
      id = "later";
      label = "Later";
    }
    const group = groups.get(id) ?? { id, label, tasks: [] };
    group.tasks.push(task);
    groups.set(id, group);
  }

  const undated = groups.get("undated");
  if (undated) {
    undated.tasks.sort((left, right) =>
      Number(right.isStarred) - Number(left.isStarred)
      || compareShortcutWorkflowStatesDescending(
        left.source === "shortcut" ? left.sourceDetails?.workflowStateName : null,
        right.source === "shortcut" ? right.sourceDetails?.workflowStateName : null,
      ));
  }

  const fixedOrder = ["overdue", "today", "tomorrow"];
  const dated = [...groups.values()]
    .filter((group) => /^\d{4}-\d{2}-\d{2}$/u.test(group.id))
    .toSorted((left, right) => left.id.localeCompare(right.id));
  return [
    ...fixedOrder.map((id) => groups.get(id)).filter((group): group is TaskSection => group !== undefined),
    ...dated,
    ...[groups.get("later"), groups.get("undated")].filter((group): group is TaskSection => group !== undefined),
  ];
}

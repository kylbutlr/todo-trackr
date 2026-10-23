import type { ShortcutBoardScope, ShortcutBoardStory, TaskPriority } from "./types.js";
import { compareShortcutWorkflowStatesDescending } from "./shortcutWorkflowOrder.js";

export type ShortcutBoardSection = {
  id: string;
  label: string;
  stories: ShortcutBoardStory[];
};

const priorityRank: Record<TaskPriority, number> = {
  highest: 0,
  high: 1,
  medium: 2,
  low: 3,
  lowest: 4,
  none: 5,
};

export function shortcutBoardScopeMatches(story: ShortcutBoardStory, scope: ShortcutBoardScope): boolean {
  switch (scope) {
    case "owner": return story.matchesOwner;
    case "requester": return story.matchesRequester;
    case "both": return story.matchesOwner && story.matchesRequester;
    case "either": return story.matchesOwner || story.matchesRequester;
  }
}

function calendarDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(value: Date, amount: number): Date {
  const result = new Date(value);
  result.setDate(result.getDate() + amount);
  return result;
}

function calendarKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function compareShortcutIDs(left: string, right: string): number {
  const leftID = Number(left);
  const rightID = Number(right);
  if (Number.isSafeInteger(leftID) && Number.isSafeInteger(rightID)) return leftID - rightID;
  return left.localeCompare(right);
}

function storyPrecedes(left: ShortcutBoardStory, right: ShortcutBoardStory): number {
  return priorityRank[left.priority] - priorityRank[right.priority]
    || Number(right.isStarred) - Number(left.isStarred)
    || (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31")
    || compareShortcutIDs(left.externalReference, right.externalReference);
}

export function queryShortcutBoard(
  stories: ShortcutBoardStory[],
  scope: ShortcutBoardScope,
  search = "",
): ShortcutBoardStory[] {
  const needle = search.trim().toLocaleLowerCase();
  return stories
    .filter((story) => shortcutBoardScopeMatches(story, scope))
    .filter((story) => !needle || [
      story.externalReference,
      story.title,
      story.workflowStateName,
      story.priority,
      story.size,
      story.epicName,
    ].join(" ").toLocaleLowerCase().includes(needle));
}

export function shortcutBoardSections(
  stories: ShortcutBoardStory[],
  now = new Date(),
): ShortcutBoardSection[] {
  const today = startOfToday(now);
  const tomorrow = addDays(today, 1);
  const afterTomorrow = addDays(today, 2);
  const laterBoundary = addDays(today, 7);
  const groups = new Map<string, ShortcutBoardSection>();

  for (const story of stories) {
    const due = story.dueDate ? calendarDate(story.dueDate) : null;
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

    const group = groups.get(id) ?? { id, label, stories: [] };
    group.stories.push(story);
    groups.set(id, group);
  }

  for (const group of groups.values()) {
    group.stories.sort((left, right) => (
      (group.id === "undated"
        ? Number(right.isStarred) - Number(left.isStarred)
          || compareShortcutWorkflowStatesDescending(left.workflowStateName, right.workflowStateName)
        : 0)
      || storyPrecedes(left, right)
    ));
  }
  const dated = [...groups.values()]
    .filter((group) => /^\d{4}-\d{2}-\d{2}$/u.test(group.id))
    .toSorted((left, right) => left.id.localeCompare(right.id));
  return [
    ...["overdue", "today", "tomorrow"].map((id) => groups.get(id)).filter((group): group is ShortcutBoardSection => group !== undefined),
    ...dated,
    ...[groups.get("later"), groups.get("undated")].filter((group): group is ShortcutBoardSection => group !== undefined),
  ];
}

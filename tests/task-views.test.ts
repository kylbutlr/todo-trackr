import { describe, expect, it } from "vitest";

import { dueState, queryTasks, taskSections, tasksForView } from "../apps/web/src/taskViews.js";
import type { Task, TaskPriority } from "../apps/web/src/types.js";

function localTimestamp(day: number, hour = 12): string {
  return new Date(2026, 7, day, hour).toISOString();
}

const now = new Date(2026, 7, 16, 12);
const inboxId = "00000000-0000-4000-8000-000000000001";

function task(overrides: Partial<Task> & { id: string; title: string }): Task {
  return {
    notes: "",
    status: "open",
    priority: "none" as TaskPriority,
    dueAt: null,
    sortOrder: 0,
    listId: inboxId,
    createdAt: localTimestamp(15),
    updatedAt: localTimestamp(15),
    completedAt: null,
    archivedAt: null,
    source: "manual",
    sourceUrl: null,
    sourceDetails: null,
    isStarred: false,
    ...overrides,
  };
}

const tasks = [
  task({ id: "overdue", title: "Overdue", dueAt: localTimestamp(15, 10), priority: "low" }),
  task({ id: "today", title: "Today", dueAt: localTimestamp(16, 19), priority: "medium" }),
  task({ id: "upcoming", title: "Upcoming", dueAt: localTimestamp(18, 10), priority: "high" }),
  task({ id: "later", title: "Client follow up", listId: "client-list", priority: "high" }),
  task({ id: "done", title: "Done", status: "completed", completedAt: localTimestamp(16, 18) }),
  task({ id: "archived", title: "Archived", status: "archived", archivedAt: localTimestamp(16, 18) }),
];

describe("task views", () => {
  it("derives local due states", () => {
    expect(dueState(tasks[0], now)).toBe("overdue");
    expect(dueState(tasks[1], now)).toBe("today");
    expect(dueState(tasks[2], now)).toBe("upcoming");
  });

  it("keeps lists distinct from smart views", () => {
    expect(tasksForView(tasks, "inbox", inboxId, now).map(({ id }) => id)).toEqual(["overdue", "today", "upcoming"]);
    expect(tasksForView(tasks, "list:client-list", inboxId, now).map(({ id }) => id)).toEqual(["later"]);
    expect(tasksForView(tasks, "completed", inboxId, now).map(({ id }) => id)).toEqual(["done"]);
    expect(tasksForView(tasks, "archived", inboxId, now).map(({ id }) => id)).toEqual(["archived"]);
    expect(tasksForView(tasks, "all", inboxId, now).map(({ id }) => id)).toEqual(["overdue", "today", "upcoming", "later"]);
  });

  it("shows only open Starred tasks in Starred while Recent includes every lifecycle", () => {
    const openStarred = task({ id: "open-starred", title: "Open starred", isStarred: true });
    const doneStarred = task({
      id: "done-starred",
      title: "Done starred",
      status: "completed",
      completedAt: localTimestamp(16, 18),
      isStarred: true,
    });

    expect(tasksForView([openStarred, doneStarred], "starred", inboxId, now).map(({ id }) => id)).toEqual(["open-starred"]);
    expect(tasksForView([openStarred, doneStarred], "recent", inboxId, now).map(({ id }) => id)).toEqual(["open-starred", "done-starred"]);
  });

  it("shows open Shortcut Tasks in their Source view and All", () => {
    const shortcut = task({ id: "shortcut", title: "Shortcut task", source: "shortcut" });
    const withShortcut = [...tasks, shortcut];

    expect(tasksForView(withShortcut, "source:shortcut", inboxId, now).map(({ id }) => id)).toEqual(["shortcut"]);
    expect(tasksForView(withShortcut, "all", inboxId, now).map(({ id }) => id)).toContain("shortcut");
  });

  it("shows Granola next steps in their Source view and All", () => {
    const granola = task({ id: "granola", title: "Meeting follow-up", source: "granola" });
    const withGranola = [...tasks, granola];

    expect(tasksForView(withGranola, "source:granola", inboxId, now).map(({ id }) => id)).toEqual(["granola"]);
    expect(tasksForView(withGranola, "all", inboxId, now).map(({ id }) => id)).toContain("granola");
  });

  it("shows Slack captures in their Source view and All", () => {
    const slack = task({ id: "slack", title: "Reply in Slack", source: "slack" });
    const withSlack = [...tasks, slack];

    expect(tasksForView(withSlack, "source:slack", inboxId, now).map(({ id }) => id)).toEqual(["slack"]);
    expect(tasksForView(withSlack, "all", inboxId, now).map(({ id }) => id)).toContain("slack");
  });

  it("smart-sorts by due state and priority", () => {
    expect(queryTasks(tasks.slice(0, 4), { search: "", priority: "any", due: "any", sort: "smart" }, now).map(({ id }) => id)).toEqual([
      "overdue",
      "today",
      "upcoming",
      "later",
    ]);
  });

  it("smart-sorts Upcoming tasks by exact due date before priority", () => {
    const dueTomorrow = task({
      id: "tomorrow",
      title: "Medium due tomorrow",
      priority: "medium",
      dueAt: localTimestamp(18, 10),
    });
    const dueNextWeek = task({
      id: "next-week",
      title: "Highest due next week",
      priority: "highest",
      dueAt: localTimestamp(24, 10),
    });

    expect(queryTasks([dueNextWeek, dueTomorrow], { search: "", priority: "any", due: "any", sort: "smart" }, now).map(({ id }) => id)).toEqual([
      "tomorrow", "next-week",
    ]);
  });

  it("uses Starred as a focus signal without overriding a nearer Upcoming date", () => {
    const starredLater = task({
      id: "starred-later",
      title: "Starred next week",
      isStarred: true,
      priority: "highest",
      dueAt: localTimestamp(24, 10),
    });
    const unstarredSooner = task({
      id: "unstarred-sooner",
      title: "Unstarred tomorrow",
      dueAt: localTimestamp(18, 10),
    });

    expect(queryTasks([starredLater, unstarredSooner], { search: "", priority: "any", due: "any", sort: "smart" }, now).map(({ id }) => id)).toEqual([
      "unstarred-sooner", "starred-later",
    ]);
  });

  it("uses Starred ahead of priority within the same Smart-sort due group", () => {
    const starredLow = task({ id: "starred-low", title: "Starred", isStarred: true, priority: "low" });
    const unstarredHighest = task({ id: "unstarred-highest", title: "Unstarred", priority: "highest" });

    expect(queryTasks([unstarredHighest, starredLow], { search: "", priority: "any", due: "any", sort: "smart" }, now).map(({ id }) => id)).toEqual([
      "starred-low", "unstarred-highest",
    ]);
  });

  it("uses numeric Shortcut ID as the final tie-breaker in Smart sort", () => {
    const shortcutTasks = [
      task({
        id: "shortcut-495541",
        title: "Gate Landing Page",
        priority: "medium",
        dueAt: localTimestamp(19),
        createdAt: localTimestamp(19, 9),
        source: "shortcut",
        sourceDetails: { externalReference: "495541", summary: null, size: null, workflowStateName: "In Progress" },
      }),
      task({
        id: "shortcut-495542",
        title: "3-Up and 4-Up",
        priority: "medium",
        dueAt: localTimestamp(19),
        createdAt: localTimestamp(19, 10),
        source: "shortcut",
        sourceDetails: { externalReference: "495542", summary: null, size: null, workflowStateName: "In Progress" },
      }),
      task({
        id: "shortcut-495540",
        title: "Muse Module",
        priority: "medium",
        dueAt: localTimestamp(19),
        createdAt: localTimestamp(19, 11),
        source: "shortcut",
        sourceDetails: { externalReference: "495540", summary: null, size: null, workflowStateName: "In Progress" },
      }),
    ];

    expect(queryTasks(shortcutTasks, { search: "", priority: "any", due: "any", sort: "smart" }, now)
      .map(({ sourceDetails }) => sourceDetails?.externalReference)).toEqual([
        "495540", "495541", "495542",
      ]);
  });

  it("groups All by useful due-date sections", () => {
    const grouped = taskSections([
      task({ id: "overdue-section", title: "Overdue", dueAt: localTimestamp(15, 10) }),
      task({ id: "today-section", title: "Today", dueAt: localTimestamp(16, 19) }),
      task({ id: "tomorrow-section", title: "Tomorrow", dueAt: localTimestamp(17, 10) }),
      task({ id: "weekday-section", title: "Wednesday", dueAt: localTimestamp(19, 10) }),
      task({ id: "later-section", title: "Later", dueAt: localTimestamp(28, 10) }),
      task({ id: "undated-section", title: "No due date" }),
    ], "all", now);

    expect(grouped.map(({ label }) => label)).toEqual([
      "Overdue", "Today", "Tomorrow", "Wednesday, Aug 19", "Later", "No due date",
    ]);
  });

  it("groups every open workspace by useful due-date sections", () => {
    const openTasks = [
      task({ id: "today-section", title: "Today", dueAt: localTimestamp(16, 19) }),
      task({ id: "undated-section", title: "No due date" }),
    ];

    for (const view of ["inbox", "starred", "list:client-list", "source:shortcut"] as const) {
      expect(taskSections(openTasks, view, now).map(({ label }) => label)).toEqual(["Today", "No due date"]);
    }
  });

  it("puts later Shortcut workflow states first only in No due date", () => {
    const shortcut = (id: string, workflowStateName: string, dueAt: string | null = null) => task({
      id,
      title: id,
      source: "shortcut",
      dueAt,
      sourceDetails: { externalReference: id, summary: null, size: null, workflowStateName },
    });
    const grouped = taskSections([
      shortcut("triage", "Triage"),
      task({ id: "manual", title: "Manual task" }),
      shortcut("qa", "QA in Staging"),
      shortcut("pending-eng", "Pending Eng"),
      shortcut("unknown", "Unknown state"),
      shortcut("dated-triage", "Triage", localTimestamp(16, 19)),
      shortcut("dated-qa", "QA in Staging", localTimestamp(16, 19)),
    ], "all", now);

    expect(grouped.find(({ id }) => id === "today")?.tasks.map(({ id }) => id)).toEqual(["dated-triage", "dated-qa"]);
    expect(grouped.find(({ id }) => id === "undated")?.tasks.map(({ id }) => id)).toEqual([
      "qa", "pending-eng", "triage", "manual", "unknown",
    ]);
  });

  it("puts starred undated tasks ahead of all unstarred workflow states", () => {
    const shortcut = (id: string, state: string, isStarred = false) => task({
      id,
      title: id,
      source: "shortcut",
      isStarred,
      dueAt: null,
      sourceDetails: { externalReference: id, summary: null, size: null, workflowStateName: state },
    });
    const grouped = taskSections([
      shortcut("unstarred-qa", "QA in Staging"),
      task({ id: "starred-manual", title: "Starred manual", isStarred: true }),
      shortcut("starred-triage", "Triage", true),
      shortcut("unstarred-eng", "Pending Eng"),
      shortcut("starred-qa", "QA in Staging", true),
    ], "all", now);

    expect(grouped.find(({ id }) => id === "undated")?.tasks.map(({ id }) => id)).toEqual([
      "starred-qa", "starred-triage", "starred-manual", "unstarred-qa", "unstarred-eng",
    ]);
  });

  it("keeps Completed and Archived as ungrouped history", () => {
    for (const view of ["completed", "archived"] as const) {
      expect(taskSections(tasks, view, now)).toEqual([{ id: "tasks", label: null, tasks }]);
    }
  });

  it("groups Recent by creation date with newest tasks first", () => {
    const recent = taskSections([
      task({ id: "yesterday", title: "Yesterday", createdAt: localTimestamp(15, 18) }),
      task({ id: "today-old", title: "Today old", createdAt: localTimestamp(16, 8) }),
      task({ id: "today-new", title: "Today new", createdAt: localTimestamp(16, 11) }),
    ], "recent", now);

    expect(recent.map(({ label }) => label)).toEqual(["Today", "Yesterday"]);
    expect(recent[0]?.tasks.map(({ id }) => id)).toEqual(["today-new", "today-old"]);
  });

  it("keeps priority ahead of exact due time for Overdue and Today tasks", () => {
    const overdueLow = task({ id: "overdue-low", title: "Older overdue", priority: "low", dueAt: localTimestamp(14, 10) });
    const overdueHigh = task({ id: "overdue-high", title: "Newer overdue", priority: "high", dueAt: localTimestamp(15, 10) });
    const todayLow = task({ id: "today-low", title: "Earlier today", priority: "low", dueAt: localTimestamp(16, 18) });
    const todayHigh = task({ id: "today-high", title: "Later today", priority: "high", dueAt: localTimestamp(16, 22) });

    expect(queryTasks([overdueLow, overdueHigh, todayLow, todayHigh], { search: "", priority: "any", due: "any", sort: "smart" }, now).map(({ id }) => id)).toEqual([
      "overdue-high", "overdue-low", "today-high", "today-low",
    ]);
  });

  it("keeps a muted Release due tomorrow ahead of undated work in Smart sort", () => {
    const release = task({
      id: "release",
      title: "Glossier Release: 8/17",
      source: "shortcut",
      priority: "highest",
      dueAt: localTimestamp(18, 10),
      sourceDetails: {
        externalReference: "490785",
        summary: "Approved Tickets: sc-486390",
        size: null,
        workflowStateName: "Ready for LOE",
      },
    });
    const actionable = task({ id: "actionable", title: "Reply to client", priority: "low" });

    expect(dueState(release, now)).toBe("upcoming");
    expect(dueState(actionable, now)).toBe("none");
    expect(queryTasks([release, actionable], { search: "", priority: "any", due: "any", sort: "smart" }, now).map(({ id }) => id)).toEqual([
      "release", "actionable",
    ]);
    expect(queryTasks([release, actionable], { search: "", priority: "any", due: "any", sort: "due" }, now).map(({ id }) => id)).toEqual([
      "release", "actionable",
    ]);
  });

  it("keeps Release muting visual without overriding Smart-sort priority", () => {
    const release = task({
      id: "release",
      title: "Ramy Brook Release: 8/19",
      source: "shortcut",
      priority: "highest",
      sourceDetails: {
        externalReference: "490801",
        summary: "Approved Tickets: sc-486633",
        size: null,
        workflowStateName: "Ready for Development",
      },
    });
    const actionable = task({ id: "actionable", title: "Reply to client", priority: "low" });

    expect(queryTasks([release, actionable], { search: "", priority: "any", due: "any", sort: "smart" }, now).map(({ id }) => id)).toEqual([
      "release", "actionable",
    ]);
  });

  it("sorts the full Priority scale without collapsing levels", () => {
    const priorities = ["lowest", "highest", "low", "high", "none", "medium"] as TaskPriority[];
    const ranked = priorities.map((priority) => task({ id: priority, title: priority, priority }));
    expect(queryTasks(ranked, { search: "", priority: "any", due: "any", sort: "priority" }, now).map(({ id }) => id)).toEqual([
      "highest", "high", "medium", "low", "lowest", "none",
    ]);
  });

  it("filters by text, priority, and due state", () => {
    expect(queryTasks(tasks, { search: "client", priority: "high", due: "none", sort: "smart" }, now).map(({ id }) => id)).toEqual(["later"]);
  });
});

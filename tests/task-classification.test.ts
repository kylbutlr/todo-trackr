import { describe, expect, it } from "vitest";

import { isBackgroundReleaseTask } from "../apps/web/src/taskClassification.js";
import type { Task } from "../apps/web/src/types.js";

function candidate(overrides: Partial<Task> = {}): Pick<Task, "source" | "sourceDetails" | "title"> {
  return {
    source: "shortcut",
    title: "Glossier Release: 8/17",
    sourceDetails: {
      externalReference: "490785",
      summary: "Approved Tickets: sc-486390",
      size: null,
      workflowStateName: "Ready for LOE",
    },
    ...overrides,
  };
}

describe("background release classification", () => {
  it("treats sparse and linked Shortcut Release tickets as background work", () => {
    expect(isBackgroundReleaseTask(candidate())).toBe(true);
    expect(isBackgroundReleaseTask(candidate({
      sourceDetails: {
        externalReference: "490785",
        summary: null,
        size: null,
        workflowStateName: "Ready for LOE",
      },
    }))).toBe(true);
  });

  it("recognizes a linked ticket even when the remaining summary is long", () => {
    expect(isBackgroundReleaseTask(candidate({
      sourceDetails: {
        externalReference: "490785",
        summary: `${"Release coordination details. ".repeat(20)} https://app.shortcut.com/sdg/story/486390`,
        size: null,
        workflowStateName: "Ready for LOE",
      },
    }))).toBe(true);
  });

  it("does not dim ordinary tickets, manual tasks, or substantial release projects", () => {
    expect(isBackgroundReleaseTask(candidate({ title: "Prepare launch checklist" }))).toBe(false);
    expect(isBackgroundReleaseTask(candidate({ source: "manual" }))).toBe(false);
    expect(isBackgroundReleaseTask(candidate({
      sourceDetails: {
        externalReference: "490785",
        summary: "This release project requires substantial implementation work and ownership. ".repeat(8),
        size: "L",
        workflowStateName: "In Progress",
      },
    }))).toBe(false);
  });
});

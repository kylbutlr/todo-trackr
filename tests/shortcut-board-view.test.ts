import { describe, expect, it } from "vitest";

import {
  queryShortcutBoard,
  shortcutBoardScopeMatches,
  shortcutBoardSections,
} from "../apps/web/src/shortcutBoard.js";
import type { ShortcutBoardStory } from "../apps/web/src/types.js";

function story(overrides: Partial<ShortcutBoardStory> = {}): ShortcutBoardStory {
  return {
    externalReference: "490801",
    sourceUrl: "https://app.shortcut.com/sdg/story/490801",
    title: "Prepare launch checklist",
    priority: "medium",
    size: "M",
    dueDate: "2026-08-21",
    workflowStateName: "In Progress",
    ownerIds: ["kyle"],
    requestedById: "ariel",
    matchesOwner: true,
    matchesRequester: false,
    isStarred: false,
    sourceUpdatedAt: "2026-08-19T12:00:00Z",
    ...overrides,
  };
}

describe("Shortcut Board view model", () => {
  it("supports Owner, Requester, both, and either personal scopes", () => {
    const owner = story();
    const requester = story({ matchesOwner: false, matchesRequester: true });
    const both = story({ matchesOwner: true, matchesRequester: true });

    expect(shortcutBoardScopeMatches(owner, "owner")).toBe(true);
    expect(shortcutBoardScopeMatches(requester, "requester")).toBe(true);
    expect(shortcutBoardScopeMatches(owner, "both")).toBe(false);
    expect(shortcutBoardScopeMatches(both, "both")).toBe(true);
    expect([owner, requester, both].filter((item) => shortcutBoardScopeMatches(item, "either"))).toHaveLength(3);
  });

  it("groups by due-date horizon and orders each group by Priority", () => {
    const sections = shortcutBoardSections([
      story({ externalReference: "1", priority: "low", dueDate: "2026-08-21" }),
      story({ externalReference: "2", priority: "highest", dueDate: "2026-08-21" }),
      story({ externalReference: "3", dueDate: null }),
    ], new Date(2026, 7, 19));

    expect(sections.map(({ id }) => id)).toEqual(["2026-08-21", "undated"]);
    expect(sections[0].stories.map(({ externalReference }) => externalReference)).toEqual(["2", "1"]);
  });

  it("puts later workflow states first in No due date while preserving dated Priority order", () => {
    const sections = shortcutBoardSections([
      story({ externalReference: "1", workflowStateName: "Triage", priority: "highest", dueDate: null }),
      story({ externalReference: "2", workflowStateName: "Pending Client", priority: "low", dueDate: null }),
      story({ externalReference: "3", workflowStateName: "Pending Eng", priority: "high", dueDate: null }),
      story({ externalReference: "4", workflowStateName: "Pending Client", priority: "high", dueDate: null }),
      story({ externalReference: "5", workflowStateName: "Triage", priority: "low", dueDate: "2026-08-21" }),
      story({ externalReference: "6", workflowStateName: "Pending Client", priority: "highest", dueDate: "2026-08-21" }),
    ], new Date(2026, 7, 19));

    expect(sections.find(({ id }) => id === "2026-08-21")?.stories.map(({ externalReference }) => externalReference)).toEqual(["6", "5"]);
    expect(sections.find(({ id }) => id === "undated")?.stories.map(({ externalReference }) => externalReference)).toEqual(["4", "2", "3", "1"]);
  });

  it("puts starred undated Stories ahead of all unstarred workflow states", () => {
    const sections = shortcutBoardSections([
      story({ externalReference: "1", workflowStateName: "QA in Staging", dueDate: null }),
      story({ externalReference: "2", workflowStateName: "", isStarred: true, dueDate: null }),
      story({ externalReference: "3", workflowStateName: "Triage", isStarred: true, dueDate: null }),
      story({ externalReference: "4", workflowStateName: "Pending Eng", dueDate: null }),
      story({ externalReference: "5", workflowStateName: "QA in Staging", isStarred: true, dueDate: null }),
    ], new Date(2026, 7, 19));

    expect(sections.find(({ id }) => id === "undated")?.stories.map(({ externalReference }) => externalReference)).toEqual([
      "5", "3", "2", "1", "4",
    ]);
  });

  it("uses numeric Shortcut ID as the final stable tie-breaker", () => {
    const sections = shortcutBoardSections([
      story({ externalReference: "494973", title: "Alpha", priority: "high" }),
      story({ externalReference: "494947", title: "Zulu", priority: "high" }),
      story({ externalReference: "494966", title: "Middle", priority: "high" }),
    ], new Date(2026, 7, 19));

    expect(sections[0].stories.map(({ externalReference }) => externalReference)).toEqual([
      "494947",
      "494966",
      "494973",
    ]);
  });

  it("searches Shortcut identifiers and planning metadata within the selected scope", () => {
    const visible = queryShortcutBoard([
      story({ externalReference: "490801", workflowStateName: "Pending Eng" }),
      story({ externalReference: "490802", title: "Requester item", matchesOwner: false, matchesRequester: true }),
    ], "owner", "pending eng");

    expect(visible.map(({ externalReference }) => externalReference)).toEqual(["490801"]);
  });

  it("searches by Shortcut Epic name", () => {
    const visible = queryShortcutBoard([
      story({ externalReference: "490801", epicName: "Browns" }),
      story({ externalReference: "490802", epicName: "SYRN" }),
    ], "owner", "syrn");

    expect(visible.map(({ externalReference }) => externalReference)).toEqual(["490802"]);
  });
});

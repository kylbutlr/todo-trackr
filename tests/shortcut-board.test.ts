import { describe, expect, it } from "vitest";

import {
  buildShortcutBoardStories,
  SHORTCUT_BOARD_STATES,
} from "../netlify/functions/lib/automation/shortcut-board.js";
import {
  KYLE_SHORTCUT_MEMBER_ID,
  SHORTCUT_PRIORITY_FIELD_ID,
  type ShortcutStory,
} from "../netlify/functions/lib/automation/shortcut-rule.js";

function story(overrides: Partial<ShortcutStory> = {}): ShortcutStory {
  return {
    id: 490801,
    app_url: "https://app.shortcut.com/sdg/story/490801",
    archived: false,
    name: "Prepare launch checklist",
    description: "",
    owner_ids: [KYLE_SHORTCUT_MEMBER_ID],
    requested_by_id: "5c943134-052d-48f6-a51c-f29504d33c6a",
    workflow_state_id: 500000051,
    custom_fields: [{ field_id: SHORTCUT_PRIORITY_FIELD_ID, value: "P1" }],
    deadline: "2026-08-21",
    updated_at: "2026-08-19T12:00:00Z",
    ...overrides,
  };
}

describe("Shortcut Board", () => {
  it("keeps active personal Stories separate from completed and unrelated Stories", () => {
    const stories = buildShortcutBoardStories([
      story(),
      story({ id: 490802, app_url: "https://app.shortcut.com/sdg/story/490802", owner_ids: [], requested_by_id: KYLE_SHORTCUT_MEMBER_ID }),
      story({ id: 490803, app_url: "https://app.shortcut.com/sdg/story/490803", workflow_state_id: 500000055 }),
      story({ id: 490804, app_url: "https://app.shortcut.com/sdg/story/490804", owner_ids: [], requested_by_id: null }),
    ]);

    expect(stories.map(({ externalReference }) => externalReference)).toEqual(["490801", "490802"]);
    expect(stories[0]).toMatchObject({
      matchesOwner: true,
      matchesRequester: false,
      priority: "high",
      dueDate: "2026-08-21",
    });
    expect(stories[1]).toMatchObject({ matchesOwner: false, matchesRequester: true });
  });

  it("includes requester-dependent and blocked awareness states", () => {
    const stateIds = [500019424, 500130176, 500000080];
    const stories = buildShortcutBoardStories(stateIds.map((workflowStateId, index) => story({
      id: 490810 + index,
      app_url: `https://app.shortcut.com/sdg/story/${490810 + index}`,
      workflow_state_id: workflowStateId,
    })));

    expect(stories.map(({ workflowStateName }) => workflowStateName)).toEqual([
      "Pending Ops",
      "Pending Client",
      "Blocked",
    ]);
    expect(Object.values(SHORTCUT_BOARD_STATES)).not.toContain("QA in Staging");
  });

  it("merges Todo Trackr-only stars without changing the Source Story", () => {
    const [result] = buildShortcutBoardStories([
      story({ epic_id: 459966, epic_name: "Browns" }),
    ], new Set(["490801"]));
    expect(result.isStarred).toBe(true);
    expect(result.sourceUrl).toBe("https://app.shortcut.com/sdg/story/490801");
    expect(result.epicName).toBe("Browns");
  });

  it("preserves Shortcut midnight UTC deadlines for Mini Trackr", () => {
    const [result] = buildShortcutBoardStories([
      story({ deadline: "2026-09-09T00:00:00Z" }),
    ]);

    expect(result.dueDate).toBe("2026-09-09");
  });
});

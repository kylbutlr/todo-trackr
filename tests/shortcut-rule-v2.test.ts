import { describe, expect, it } from "vitest";

import {
  KYLE_SHORTCUT_MEMBER_ID,
  type ShortcutStory,
} from "../netlify/functions/lib/automation/shortcut-rule.js";
import {
  evaluateShortcutRuleV2,
  type ShortcutComment,
} from "../netlify/functions/lib/automation/shortcut-rule-v2.js";

const ARIEL_ID = "5c943134-052d-48f6-a51c-f29504d33c6a";

function story(overrides: Partial<ShortcutStory> = {}): ShortcutStory {
  return {
    id: 490801,
    app_url: "https://app.shortcut.com/sdg/story/490801",
    archived: false,
    name: "Prepare launch checklist",
    description: "Confirm the release steps.",
    owner_ids: [],
    requested_by_id: null,
    member_mention_ids: [],
    workflow_state_id: 500000051,
    custom_fields: [],
    deadline: null,
    updated_at: "2026-08-16T12:00:00Z",
    ...overrides,
  };
}

function comment(overrides: Partial<ShortcutComment> = {}): ShortcutComment {
  return {
    id: 9001,
    app_url: "https://app.shortcut.com/sdg/story/490801#activity-9001",
    author_id: ARIEL_ID,
    member_mention_ids: [KYLE_SHORTCUT_MEMBER_ID],
    parent_id: null,
    text: "@Kyle please confirm the launch date.",
    deleted: false,
    created_at: "2026-08-16T12:00:00Z",
    updated_at: "2026-08-16T12:00:00Z",
    ...overrides,
  };
}

describe("Shortcut Responsibility Rule v2 shadow", () => {
  it("treats direct assignment as a primary source-controlled Responsibility", () => {
    expect(evaluateShortcutRuleV2(story({ owner_ids: [KYLE_SHORTCUT_MEMBER_ID] }))).toMatchObject({
      outcome: "open",
      salience: "primary",
      reasonSummary: "Assigned to Kyle",
    });
  });

  it("treats requester-only Stories as muted background Responsibilities", () => {
    expect(evaluateShortcutRuleV2(story({ requested_by_id: KYLE_SHORTCUT_MEMBER_ID }))).toMatchObject({
      outcome: "open",
      salience: "background",
      reasonSummary: "Requested by Kyle",
    });
  });

  it("aggregates multiple active Responsibility Reasons without duplicating the Task", () => {
    const result = evaluateShortcutRuleV2(story({
      owner_ids: [KYLE_SHORTCUT_MEMBER_ID],
      requested_by_id: KYLE_SHORTCUT_MEMBER_ID,
    }));

    expect(result.reasons.map(({ kind }) => kind)).toEqual(["assigned", "requester"]);
    expect(result.salience).toBe("primary");
    expect(result.outcome).toBe("open");
  });

  it("creates a user-completable Heads Up for an explicit comment request", () => {
    expect(evaluateShortcutRuleV2(story(), [comment()])).toMatchObject({
      outcome: "open",
      salience: "heads_up",
      reasons: [expect.objectContaining({
        kind: "comment_request",
        active: true,
        userCompletable: true,
      })],
    });
  });

  it("treats a later Kyle comment as the Heads Up Completion Signal", () => {
    const result = evaluateShortcutRuleV2(story(), [
      comment(),
      comment({
        id: 9002,
        author_id: KYLE_SHORTCUT_MEMBER_ID,
        member_mention_ids: [],
        text: "Confirmed, we are launching Tuesday.",
        created_at: "2026-08-16T12:05:00Z",
      }),
    ]);

    expect(result.outcome).toBe("complete");
    expect(result.reasons[0]).toMatchObject({
      active: false,
      completionSignal: expect.stringContaining("Kyle responded"),
    });
  });

  it("keeps another active reason open after a Heads Up is satisfied", () => {
    const result = evaluateShortcutRuleV2(story({ requested_by_id: KYLE_SHORTCUT_MEMBER_ID }), [
      comment(),
      comment({
        id: 9002,
        author_id: KYLE_SHORTCUT_MEMBER_ID,
        member_mention_ids: [],
        text: "Handled.",
        created_at: "2026-08-16T12:05:00Z",
      }),
    ]);

    expect(result.outcome).toBe("open");
    expect(result.salience).toBe("background");
    expect(result.reasons.filter(({ active }) => active).map(({ kind }) => kind)).toEqual(["requester"]);
  });

  it("recognizes a direct description request but ignores a casual mention", () => {
    expect(evaluateShortcutRuleV2(story({
      description: "@Kyle please review the client response.",
      member_mention_ids: [KYLE_SHORTCUT_MEMBER_ID],
    }))).toMatchObject({ outcome: "open", salience: "heads_up" });

    expect(evaluateShortcutRuleV2(story({
      description: "Kyle attended the planning meeting.",
      member_mention_ids: [KYLE_SHORTCUT_MEMBER_ID],
    }))).toMatchObject({ outcome: "ignore" });
  });

  it("leaves Agentic QA and QA In Progress Responsibilities open on hold", () => {
    expect(evaluateShortcutRuleV2(story({
      owner_ids: [KYLE_SHORTCUT_MEMBER_ID],
      workflow_state_id: 500130165,
    }))).toMatchObject({ outcome: "hold", workflowStateName: "Agentic QA" });
    expect(evaluateShortcutRuleV2(story({
      owner_ids: [KYLE_SHORTCUT_MEMBER_ID],
      workflow_state_id: 500130660,
    }))).toMatchObject({ outcome: "hold", workflowStateName: "QA In Progress" });
  });

  it("completes at QA in Staging and later configured completion states", () => {
    expect(evaluateShortcutRuleV2(story({
      owner_ids: [KYLE_SHORTCUT_MEMBER_ID],
      workflow_state_id: 500000081,
    }))).toMatchObject({ outcome: "complete", workflowStateName: "QA in Staging" });
  });
});

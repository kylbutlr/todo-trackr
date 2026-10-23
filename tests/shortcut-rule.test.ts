import { describe, expect, it } from "vitest";

import {
  KYLE_SHORTCUT_MEMBER_ID,
  SHORTCUT_PRIORITY_FIELD_ID,
  SHORTCUT_SIZE_FIELD_ID,
  normalizeShortcutStory,
  previewShortcutStory,
  type ExistingShortcutTask,
  type ShortcutStory,
} from "../netlify/functions/lib/automation/shortcut-rule.js";

function story(overrides: Partial<ShortcutStory> = {}): ShortcutStory {
  return {
    id: 490801,
    app_url: "https://app.shortcut.com/sdg/story/490801",
    archived: false,
    name: "Prepare launch checklist",
    description: "Confirm the release steps and identify the owner of each step.",
    owner_ids: [KYLE_SHORTCUT_MEMBER_ID],
    workflow_state_id: 500000051,
    custom_fields: [
      { field_id: SHORTCUT_PRIORITY_FIELD_ID, value: "P0" },
      { field_id: SHORTCUT_SIZE_FIELD_ID, value: "M" },
    ],
    deadline: "2026-08-19T07:00:00Z",
    updated_at: "2026-08-16T12:00:00Z",
    ...overrides,
  };
}

function existing(overrides: Partial<ExistingShortcutTask> = {}): ExistingShortcutTask {
  return {
    taskId: "00000000-0000-4000-8000-000000000901",
    externalReference: "490801",
    lifecycle: "open",
    sourceFingerprint: "previous-source-fingerprint",
    summaryFingerprint: null,
    sourceSummary: null,
    ...overrides,
  };
}

describe("Direct Shortcut Responsibility preview", () => {
  it("normalizes Shortcut planning fields without collapsing priority", () => {
    expect(normalizeShortcutStory(story({ epic_id: 459966, epic_name: "Browns" }))).toMatchObject({
      externalReference: "490801",
      priority: "highest",
      size: "M",
      dueDate: "2026-08-19",
      workflowStateName: "In Progress",
      epicId: 459966,
      epicName: "Browns",
    });
  });

  it("normalizes every Shortcut P-level into the Todo Trackr priority scale", () => {
    const expectations = [
      ["P0", "highest"],
      ["P1", "high"],
      ["P2", "medium"],
      ["P3", "low"],
      ["P4", "lowest"],
    ] as const;

    for (const [value, priority] of expectations) {
      expect(normalizeShortcutStory(story({
        custom_fields: [{ field_id: SHORTCUT_PRIORITY_FIELD_ID, value }],
      })).priority).toBe(priority);
    }
  });

  it("normalizes Priority when Shortcut returns only its enum value ID", () => {
    expect(normalizeShortcutStory(story({
      custom_fields: [{
        field_id: SHORTCUT_PRIORITY_FIELD_ID,
        value_id: "6260481e-028f-4be7-9d97-0c46f05a0c80",
      }],
    })).priority).toBe("high");
  });

  it("normalizes Size when Shortcut returns only its enum value ID", () => {
    expect(normalizeShortcutStory(story({
      custom_fields: [{
        field_id: SHORTCUT_SIZE_FIELD_ID,
        value_id: "6a57ae0b-05dc-4983-8ccb-ebaa0c7deaea",
      }],
    })).size).toBe("L");
  });

  it("preserves Shortcut date-only deadlines without a timezone shift", () => {
    expect(normalizeShortcutStory(story({ deadline: "2026-08-19" })).dueDate).toBe("2026-08-19");
  });

  it("preserves Shortcut midnight UTC deadlines as source calendar dates", () => {
    expect(normalizeShortcutStory(story({ deadline: "2026-09-09T00:00:00Z" })).dueDate).toBe("2026-09-09");
  });

  it("creates a Task for an assigned actionable story", () => {
    expect(previewShortcutStory(story())).toMatchObject({
      action: "create",
      needsSummary: true,
    });
  });

  it("updates the workflow label when an open Task moves between active states", () => {
    const before = normalizeShortcutStory(story({ workflow_state_id: 500000056 }));
    const task = existing({
      sourceFingerprint: before.sourceFingerprint,
      summaryFingerprint: before.contentFingerprint,
      sourceSummary: "Existing source summary.",
    });
    for (const [stateId, name] of [[500000051, "In Progress"], [500127059, "Pending Eng"]] as const) {
      const changed = previewShortcutStory(story({ workflow_state_id: stateId }), task);
      expect(changed).toMatchObject({
        action: "update",
        taskId: task.taskId,
        currentLifecycle: "open",
        workflowStateId: stateId,
        workflowStateName: name,
        needsSummary: false,
        sourceSummary: task.sourceSummary,
      });
      expect(changed.sourceFingerprint).not.toBe(task.sourceFingerprint);
      task.sourceFingerprint = changed.sourceFingerprint;
    }
  });

  it("completes an open Task when a completion state and unassignment arrive together", () => {
    expect(previewShortcutStory(story({
      owner_ids: [],
      workflow_state_id: 500000081,
    }), existing())).toMatchObject({
      action: "complete",
      workflowStateName: "QA in Staging",
    });
  });

  it("archives an open Task when Kyle is unassigned in an active state", () => {
    expect(previewShortcutStory(story({ owner_ids: [] }), existing())).toMatchObject({
      action: "archive",
    });
  });

  it("does not retroactively complete a previously archived Responsibility", () => {
    expect(previewShortcutStory(
      story({ owner_ids: [], workflow_state_id: 500000081 }),
      existing({ lifecycle: "archived" }),
    )).toMatchObject({ action: "ignore" });
  });

  it("reopens the same Task when an actionable Responsibility returns", () => {
    expect(previewShortcutStory(story(), existing({ lifecycle: "archived" }))).toMatchObject({
      action: "reopen",
      taskId: "00000000-0000-4000-8000-000000000901",
    });
  });

  it("ignores assigned stories that are already in a completion state", () => {
    expect(previewShortcutStory(story({ workflow_state_id: 500019424 }))).toMatchObject({
      action: "ignore",
      workflowStateName: "Pending Ops",
    });
  });
});

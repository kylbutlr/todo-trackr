import { describe, expect, it, vi } from "vitest";

import { applyApprovedShortcutChanges } from "../netlify/functions/lib/automation/shortcut-reconcile.js";
import { DEFAULT_SHORTCUT_RULE_SETTINGS } from "../netlify/functions/lib/automation/shortcut-rule.js";
import { buildShortcutPreview } from "../netlify/functions/lib/automation/shortcut-preview.js";
import { KYLE_SHORTCUT_MEMBER_ID, type ShortcutStory } from "../netlify/functions/lib/automation/shortcut-rule.js";

const changedStory: ShortcutStory = {
  id: 489619,
  app_url: "https://app.shortcut.com/sdg/story/489619",
  archived: false,
  name: "Setup TRAIN Concierge Environment",
  description: "Updated Shortcut request.",
  owner_ids: [KYLE_SHORTCUT_MEMBER_ID],
  workflow_state_id: 500127059,
  custom_fields: [],
  deadline: "2026-08-17",
  updated_at: "2026-08-16T17:30:00Z",
};

async function updatePreview() {
  return buildShortcutPreview({
    loadRule: async () => DEFAULT_SHORTCUT_RULE_SETTINGS,
    loadContext: async () => ({
      connection: {
        id: "00000000-0000-4000-8000-000000000100",
        name: "Shortcut",
        paused: false,
        syncMode: "review",
        controlMode: "review",
        health: "healthy",
        lastSuccessAt: null,
        lastFailureAt: null,
        lastFailureMessage: null,
        lastWebhookAt: null,
        lastFullSyncAt: null,
        nextRepairAt: null,
        repairIntervalSeconds: 900,
      },
      existingTasks: [{
        taskId: "00000000-0000-4000-8000-000000000619",
        externalReference: "489619",
        lifecycle: "open",
        sourceFingerprint: "previous-fingerprint",
        summaryFingerprint: "previous-summary-fingerprint",
        sourceSummary: "Previous Shortcut request.",
      }],
    }),
    observeStories: async () => ({ stories: [changedStory], unavailableReferences: [] }),
    now: () => new Date("2026-08-16T17:32:00Z"),
  });
}

describe("approved Shortcut reconciliation", () => {
  it("applies the exact approved update while leaving the connection in Review", async () => {
    const preview = await updatePreview();
    const apply = vi.fn(async () => undefined);

    const result = await applyApprovedShortcutChanges(preview.approval.token!, {
      preview: async () => preview,
      apply,
    });

    expect(result).toEqual({
      applied: 1,
      connectionPaused: false,
      counts: { create: 0, update: 1, complete: 0, reopen: 0, archive: 0 },
    });
    expect(apply).toHaveBeenCalledWith([
      expect.objectContaining({ action: "update", externalReference: "489619" }),
    ]);
  });

  it("rejects approval after Shortcut changes again", async () => {
    const preview = await updatePreview();
    const apply = vi.fn(async () => undefined);

    await expect(applyApprovedShortcutChanges("0".repeat(64), {
      preview: async () => preview,
      apply,
    })).rejects.toThrow("Shortcut changed after this preview");
    expect(apply).not.toHaveBeenCalled();
  });
});

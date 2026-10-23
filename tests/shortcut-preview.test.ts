import { describe, expect, it } from "vitest";

import { DEFAULT_SHORTCUT_RULE_SETTINGS } from "../netlify/functions/lib/automation/shortcut-rule.js";
import { buildShortcutPreview } from "../netlify/functions/lib/automation/shortcut-preview.js";
import { KYLE_SHORTCUT_MEMBER_ID, type ShortcutStory } from "../netlify/functions/lib/automation/shortcut-rule.js";

const actionableStory: ShortcutStory = {
  id: 490801,
  app_url: "https://app.shortcut.com/sdg/story/490801",
  archived: false,
  name: "Prepare launch checklist",
  description: "Confirm every release step.",
  owner_ids: [KYLE_SHORTCUT_MEMBER_ID],
  workflow_state_id: 500000051,
  custom_fields: [],
  deadline: null,
  updated_at: "2026-08-16T12:00:00Z",
};

describe("Shortcut reconciliation preview", () => {
  it("returns proposed changes without applying them", async () => {
    const preview = await buildShortcutPreview({
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
        existingTasks: [],
      }),
      observeStories: async () => ({ stories: [actionableStory], unavailableReferences: [] }),
      now: () => new Date("2026-08-16T12:00:00Z"),
    });

    expect(preview).toMatchObject({
      mode: "preview",
      generatedAt: "2026-08-16T12:00:00.000Z",
      counts: { create: 1, complete: 0, reopen: 0, archive: 0 },
      items: [{
        externalReference: "490801",
        action: "create",
        sourceSummary: "Confirm every release step.",
      }],
    });
  });

  it("keeps the Source description provider replaceable", async () => {
    const preview = await buildShortcutPreview({
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
        existingTasks: [],
      }),
      observeStories: async () => ({ stories: [actionableStory], unavailableReferences: [] }),
      describeSources: async () => ["Custom source description."],
      now: () => new Date("2026-08-16T12:00:00Z"),
    });

    expect(preview.items[0]).toMatchObject({
      action: "create",
      sourceSummary: "Custom source description.",
    });
  });
});

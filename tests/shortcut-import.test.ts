import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { importInitialShortcutTasks } from "../netlify/functions/lib/automation/shortcut-import.js";
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

async function importablePreview() {
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
      existingTasks: [],
    }),
    observeStories: async () => ({ stories: [actionableStory], unavailableReferences: [] }),
    now: () => new Date("2026-08-16T12:00:00Z"),
  });
}

describe("initial Shortcut import", () => {
  it("persists imported Tasks with Shortcut source identity", () => {
    const repository = readFileSync(
      new URL("../netlify/functions/lib/automation/shortcut-repository.ts", import.meta.url),
      "utf8",
    );

    expect(repository).toMatch(
      /INSERT INTO tasks\s*\([^)]*\bsource\b[^)]*\)[\s\S]*?'shortcut'/u,
    );
  });

  it("applies the exact approved create-only preview and stays in Review", async () => {
    const preview = await importablePreview();
    const apply = vi.fn(async () => undefined);

    const result = await importInitialShortcutTasks(preview.initialImport.approvalToken!, {
      preview: async () => preview,
      apply,
    });

    expect(result).toEqual({ imported: 1, connectionPaused: false });
    expect(apply).toHaveBeenCalledWith([expect.objectContaining({
      externalReference: "490801",
      action: "create",
    })]);
  });

  it("rejects an import when Shortcut changed after approval", async () => {
    const preview = await importablePreview();
    const apply = vi.fn(async () => undefined);

    await expect(importInitialShortcutTasks("0".repeat(64), {
      preview: async () => preview,
      apply,
    })).rejects.toThrow("Shortcut changed after this preview");
    expect(apply).not.toHaveBeenCalled();
  });
});

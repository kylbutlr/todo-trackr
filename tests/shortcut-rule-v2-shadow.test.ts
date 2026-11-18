import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { KYLE_SHORTCUT_MEMBER_ID, type ShortcutStory } from "../netlify/functions/lib/automation/shortcut-rule.js";
import { refreshShortcutRuleV2Shadow } from "../netlify/functions/lib/automation/shortcut-rule-v2-shadow.js";
import type { ShortcutRuleV2ShadowSnapshot } from "../netlify/functions/lib/automation/shortcut-shadow-repository.js";

const repositoryRoot = new URL("../", import.meta.url);

function story(): ShortcutStory {
  return {
    id: 490801,
    app_url: "https://app.shortcut.com/sdg/story/490801",
    archived: false,
    name: "Prepare launch checklist",
    description: "Confirm the release steps.",
    owner_ids: [KYLE_SHORTCUT_MEMBER_ID],
    workflow_state_id: 500000051,
    custom_fields: [],
    deadline: null,
    updated_at: "2026-08-16T12:00:00Z",
  };
}

describe("Shortcut Rule v2 shadow runner", () => {
  it("records evaluated candidates and returns stored shadow state without applying Tasks", async () => {
    const record = vi.fn(async () => undefined);
    const snapshot: ShortcutRuleV2ShadowSnapshot = {
      mode: "shadow",
      ruleVersion: 2,
      generatedAt: "2026-08-16T12:00:00Z",
      coverageStartedAt: "2026-08-16T12:00:00Z",
      mutatesTasks: false,
      counts: { open: 1, hold: 0, complete: 0, ignore: 0, primary: 1, heads_up: 0, background: 0 },
      items: [],
    };

    await expect(refreshShortcutRuleV2Shadow(undefined, {
      existingReferences: async () => [],
      observeCandidates: async () => ({ stories: [story()], unavailableReferences: [] }),
      observeComments: async () => [],
      record,
      load: async () => snapshot,
    })).resolves.toEqual(snapshot);

    expect(record).toHaveBeenCalledWith([
      expect.objectContaining({ externalReference: "490801", outcome: "open", salience: "primary" }),
    ]);
  });

  it("ships v2 as a proposed rule with dedicated shadow storage and no activation timestamp", () => {
    const migration = readFileSync(
      new URL("database/migrations/0008_shortcut_rule_v2_shadow.sql", repositoryRoot),
      "utf8",
    );
    const api = readFileSync(new URL("netlify/functions/api.mts", repositoryRoot), "utf8");

    expect(migration).toContain("'proposed'");
    expect(migration).toContain("automation_rule_shadow_observations");
    expect(migration).toContain('"shadow_only": true');
    expect(migration).not.toMatch(/version, status, config, activated_at[\s\S]*?\n\s*2,/u);
    expect(api).toContain('/api/connections/shortcut/rule-v2-shadow');
  });
});

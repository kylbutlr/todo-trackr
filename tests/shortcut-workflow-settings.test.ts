import { describe, expect, it, vi } from "vitest";
import { ShortcutClient } from "../netlify/functions/lib/automation/shortcut-client.js";
import { ACTIVE_SHORTCUT_STATES, COMPLETION_SHORTCUT_STATES, KYLE_SHORTCUT_MEMBER_ID, previewShortcutStory } from "../netlify/functions/lib/automation/shortcut-rule.js";

const story = {
  id: 490801, app_url: "https://app.shortcut.com/sdg/story/490801", name: "Triage the issue",
  description: "", owner_ids: [KYLE_SHORTCUT_MEMBER_ID], workflow_state_id: 500134189,
  archived: false, custom_fields: [], deadline: null,
};
const rule = {
  version: 3,
  activeStates: { ...ACTIVE_SHORTCUT_STATES, 500134189: "Engineering Triage" },
  completionStates: COMPLETION_SHORTCUT_STATES,
};

describe("configurable Shortcut workflow states", () => {
  it("creates Engineering Triage Tasks when selected, while preserving assignment requirements", () => {
    expect(previewShortcutStory(story, undefined, rule)).toMatchObject({ action: "create", workflowStateName: "Engineering Triage" });
    expect(previewShortcutStory({ ...story, owner_ids: [] }, undefined, rule).action).toBe("ignore");
  });

  it("archives an existing Task when its state is deselected and reopens it when selected again", () => {
    const existing = { taskId: "task-one", externalReference: "490801", lifecycle: "open" as const, sourceFingerprint: "old", summaryFingerprint: null, sourceSummary: null };
    expect(previewShortcutStory(story, existing).action).toBe("archive");
    expect(previewShortcutStory(story, { ...existing, lifecycle: "archived" }, rule).action).toBe("reopen");
  });

  it("fetches the selected states, including Engineering Triage, and still observes previously linked Tasks", async () => {
    const request = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).endsWith("/stories/490802")) return Response.json({ ...story, id: 490802, workflow_state_id: 500000055 });
      const body = JSON.parse(String(init?.body));
      return Response.json(body.workflow_state_id === 500134189 ? [story] : []);
    });
    const result = await new ShortcutClient(request as typeof fetch, "test-token").observeOwnedStories(KYLE_SHORTCUT_MEMBER_ID, ["490802"], rule.activeStates);
    expect(result.stories.map(({ id }) => id)).toEqual([490801, 490802]);
    expect(request.mock.calls.some(([, init]) => init?.body && JSON.parse(String(init.body)).workflow_state_id === 500134189)).toBe(true);
  });
});

import { selectedShortcutStates, shortcutSettingsSchema, ruleSettingsFromRow } from "../netlify/functions/lib/automation/shortcut-settings.js";
import { buildShortcutPreview } from "../netlify/functions/lib/automation/shortcut-preview.js";

const workflowStates = [
  { id: 500134189, name: "Engineering Triage", type: "started" as const, workflowName: "Engineering" },
  { id: 500000055, name: "Completed", type: "done" as const, workflowName: "Engineering" },
];

it("validates live workflow choices, deduplicates IDs, and allows an empty selection", () => {
  expect(selectedShortcutStates([500134189, 500134189], workflowStates)).toEqual({ 500134189: "Engineering Triage" });
  expect(selectedShortcutStates([], workflowStates)).toEqual({});
  expect(() => selectedShortcutStates([500000055], workflowStates)).toThrow("unfinished");
  expect(() => selectedShortcutStates([123], workflowStates)).toThrow("unfinished");
  expect(shortcutSettingsSchema.safeParse({ expectedVersion: 0, activeStateIds: [] }).success).toBe(false);
  expect(shortcutSettingsSchema.safeParse({ expectedVersion: 1, activeStateIds: [500134189], memberId: "someone-else" }).success).toBe(false);
});

it("reads the existing persisted rule without broadening its default state selection", () => {
  expect(ruleSettingsFromRow({ version: 1, config: { active_states: ACTIVE_SHORTCUT_STATES, completion_states: COMPLETION_SHORTCUT_STATES } })).toMatchObject({ version: 1, activeStates: ACTIVE_SHORTCUT_STATES });
  expect(() => ruleSettingsFromRow({ version: 1, config: {} })).toThrow();
});

const connection = {
  id: "connection", name: "Shortcut", paused: false, syncMode: "review" as const, controlMode: "review" as const,
  health: "healthy" as const, lastSuccessAt: null, lastFailureAt: null, lastFailureMessage: null,
  lastWebhookAt: null, lastFullSyncAt: null, nextRepairAt: null, repairIntervalSeconds: 21600,
};

it("uses one saved selection for fetching, preview decisions, and approval identity", async () => {
  const observeStories = vi.fn(async () => ({ stories: [story], unavailableReferences: [] }));
  const dependencies = {
    loadRule: async () => rule,
    loadContext: async () => ({ connection, existingTasks: [] }),
    observeStories,
  };
  const preview = await buildShortcutPreview(dependencies);
  expect(observeStories).toHaveBeenCalledWith([], rule.activeStates);
  expect(preview.items[0]).toMatchObject({ action: "create", workflowStateName: "Engineering Triage", ruleVersion: 3 });
  expect(preview.rule.activeStates).toEqual(rule.activeStates);
  const revised = await buildShortcutPreview({ ...dependencies, loadRule: async () => ({ ...rule, version: 4 }) });
  expect(revised.approval.token).not.toBe(preview.approval.token);
});

it("can track a previously completing state while retaining completion for other states", async () => {
  const preview = await buildShortcutPreview({
    loadRule: async () => ({ ...rule, activeStates: { 500019424: "Pending Ops" } }),
    loadContext: async () => ({ connection, existingTasks: [] }),
    observeStories: async () => ({ stories: [{ ...story, workflow_state_id: 500019424 }], unavailableReferences: [] }),
  });
  expect(preview.items[0].action).toBe("create");
  expect(preview.rule.completionStates).not.toHaveProperty("500019424");
  expect(preview.rule.completionStates).toHaveProperty("500000055", "Completed");
});

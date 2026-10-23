import { describe, expect, it, vi } from "vitest";
import { refreshShortcutWorkflowDraft, subscribeToShortcutWorkflowReturn } from "../apps/web/src/shortcutWorkflowDraft.js";
import { resolveShortcutRuleSettings } from "../netlify/functions/lib/automation/shortcut-settings.js";
import { KYLE_SHORTCUT_MEMBER_ID, normalizeShortcutStory, previewShortcutStory } from "../netlify/functions/lib/automation/shortcut-rule.js";
import { ShortcutClient } from "../netlify/functions/lib/automation/shortcut-client.js";
import { buildShortcutPreview } from "../netlify/functions/lib/automation/shortcut-preview.js";
import type { ShortcutWorkflowSettings } from "../apps/web/src/types.js";

const original: ShortcutWorkflowSettings = {
  version: 3, activeStates: { 500134189: "Engineering Triage" }, completionStates: { 500000055: "Completed" },
  availableStates: [
    { id: 500134189, name: "Engineering Triage", type: "started", workflowName: "Engineering" },
    { id: 500000051, name: "In Progress", type: "started", workflowName: "Engineering" },
    { id: 500000055, name: "Completed", type: "done", workflowName: "Engineering" },
  ],
};

describe("dynamic Shortcut workflow state refresh", () => {
  it("preserves unsaved checkbox edits while accepting added, renamed, and removed catalog entries", () => {
    const next = { ...original, availableStates: original.availableStates.filter(({ id }) => id !== 500000051).map((state) => ({ ...state, name: state.id === 500134189 ? "Renamed triage" : state.name })) };
    next.availableStates.push({ id: 999001, name: "New fixture state", type: "started", workflowName: "Engineering" });
    const refreshed = refreshShortcutWorkflowDraft(original, [500000051], next);
    expect(refreshed.selected).toEqual([500000051]);
    expect(refreshed.settings.availableStates).toEqual(next.availableStates);
    expect(refreshed.conflict).toBe(false);
  });

  it("leaves newly created states unselected when there is no local draft", () => {
    const next: ShortcutWorkflowSettings = { ...original, availableStates: [...original.availableStates, { id: 999001, name: "New fixture state", type: "started", workflowName: "Engineering" }] };
    expect(refreshShortcutWorkflowDraft(original, [500134189], next).selected).toEqual([500134189]);
  });

  it("stops before observing or proposing Tasks if loading the live catalog fails", async () => {
    const observeStories = vi.fn();
    const loadContext = vi.fn();
    await expect(buildShortcutPreview({ loadRule: async () => { throw new Error("Catalog unavailable"); }, loadContext, observeStories })).rejects.toThrow("Catalog unavailable");
    expect(observeStories).not.toHaveBeenCalled();
    expect(loadContext).not.toHaveBeenCalled();
  });

  it("refreshes on window focus and visible-tab return, and unsubscribes on leaving settings", () => {
    const windowTarget = new EventTarget();
    const documentTarget: EventTarget & { visibilityState: DocumentVisibilityState } = Object.assign(new EventTarget(), { visibilityState: "hidden" as const });
    const refresh = vi.fn();
    const unsubscribe = subscribeToShortcutWorkflowReturn(refresh, windowTarget, documentTarget);
    windowTarget.dispatchEvent(new Event("focus"));
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).not.toHaveBeenCalled();
    documentTarget.visibilityState = "visible";
    windowTarget.dispatchEvent(new Event("focus"));
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalledTimes(2);
    unsubscribe();
    windowTarget.dispatchEvent(new Event("focus"));
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("accepts another device's saved selection when there is no local draft", () => {
    const next = { ...original, version: 4, activeStates: { 500000051: "In Progress" } };
    expect(refreshShortcutWorkflowDraft(original, [500134189], next)).toMatchObject({ settings: next, selected: [500000051], conflict: false });
  });

  it("keeps the old version guard and unsaved selections when another device saved a competing rule", () => {
    const next = { ...original, version: 4, activeStates: { 500000051: "In Progress" } };
    const refreshed = refreshShortcutWorkflowDraft(original, [], next);
    expect(refreshed.settings.version).toBe(3);
    expect(refreshed.settings.activeStates).toEqual(original.activeStates);
    expect(refreshed.selected).toEqual([]);
    expect(refreshed.conflict).toBe(true);
  });

  it("uses current names and skips removed or finished states without changing saved selections", () => {
    const resolved = resolveShortcutRuleSettings(original, [
      { ...original.availableStates[0], name: "Renamed triage" },
      { ...original.availableStates[2], name: "Finished" },
    ]);
    expect(resolved.activeStates).toEqual({ 500134189: "Renamed triage" });
    expect(resolved.completionStates).toEqual({ 500000055: "Finished" });
    expect(resolveShortcutRuleSettings(original, [original.availableStates[2]]).activeStates).toEqual({});
    expect(resolveShortcutRuleSettings(original, [{ ...original.availableStates[0], type: "done" }]).activeStates).toEqual({});
    expect(normalizeShortcutStory({ id: 490802, name: "Moved fixture", app_url: "https://app.shortcut.com/sdg/story/490802", owner_ids: [], workflow_state_id: 500000055, archived: false, description: "", custom_fields: [], deadline: null }, resolved).workflowStateName).toBe("Finished");
    expect(original.activeStates).toEqual({ 500134189: "Engineering Triage" });
  });

  it("avoids searches for removed state IDs but still observes linked Stories", async () => {
    const rule = resolveShortcutRuleSettings(original, [original.availableStates[2]]);
    const linkedStory = { id: 490801, app_url: "https://app.shortcut.com/sdg/story/490801", name: "Moved fixture", description: "", owner_ids: [KYLE_SHORTCUT_MEMBER_ID], workflow_state_id: 500000055, archived: false, custom_fields: [], deadline: null };
    const request = vi.fn(async () => Response.json(linkedStory));
    const result = await new ShortcutClient(request, "fixture-token").observeOwnedStories(KYLE_SHORTCUT_MEMBER_ID, ["490801"], rule.activeStates);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("https://api.app.shortcut.com/api/v3/stories/490801", expect.any(Object));
    expect(previewShortcutStory(result.stories[0], { taskId: "task", externalReference: "490801", lifecycle: "open", sourceFingerprint: "old", summaryFingerprint: null, sourceSummary: null }, rule).action).toBe("complete");
  });

  it("updates an existing Task after a workflow rename, even if its Story is otherwise unchanged", () => {
    const story = { id: 490801, app_url: "https://app.shortcut.com/sdg/story/490801", name: "Triage issue", description: "", owner_ids: [KYLE_SHORTCUT_MEMBER_ID], workflow_state_id: 500134189, archived: false, custom_fields: [], deadline: null };
    const before = normalizeShortcutStory(story, original);
    const current = resolveShortcutRuleSettings(original, [{ ...original.availableStates[0], name: "Renamed triage" }]);
    expect(previewShortcutStory(story, { taskId: "task", externalReference: "490801", lifecycle: "open", sourceFingerprint: before.sourceFingerprint, summaryFingerprint: null, sourceSummary: null }, current)).toMatchObject({ action: "update", workflowStateName: "Renamed triage" });
  });
});

import type { ShortcutWorkflowSettings } from "./types.js";

export function hasShortcutWorkflowDraft(settings: ShortcutWorkflowSettings, selected: number[]): boolean {
  return selected.toSorted((a, b) => a - b).join(",") !== Object.keys(settings.activeStates).map(Number).sort((a, b) => a - b).join(",");
}

export function refreshShortcutWorkflowDraft(
  current: ShortcutWorkflowSettings | undefined,
  selected: number[],
  next: ShortcutWorkflowSettings,
) {
  if (!current || !hasShortcutWorkflowDraft(current, selected)) {
    return { settings: next, selected: Object.keys(next.activeStates).map(Number), conflict: false };
  }
  const conflict = current.version !== next.version;
  return {
    // Refresh the catalog while keeping the original baseline for stale-save
    // detection. A catalog refresh never authorizes overwriting another device.
    settings: conflict ? { ...current, availableStates: next.availableStates } : next,
    selected,
    conflict,
  };
}

export function subscribeToShortcutWorkflowReturn(
  refresh: () => void,
  windowTarget: EventTarget = window,
  documentTarget: EventTarget & { readonly visibilityState: DocumentVisibilityState } = document,
): () => void {
  const refreshOnReturn = () => {
    if (documentTarget.visibilityState === "visible") refresh();
  };
  windowTarget.addEventListener("focus", refreshOnReturn);
  documentTarget.addEventListener("visibilitychange", refreshOnReturn);
  return () => {
    windowTarget.removeEventListener("focus", refreshOnReturn);
    documentTarget.removeEventListener("visibilitychange", refreshOnReturn);
  };
}

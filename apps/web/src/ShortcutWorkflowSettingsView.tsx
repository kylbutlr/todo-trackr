import { useEffect, useRef, useState } from "react";
import { hasShortcutWorkflowDraft, refreshShortcutWorkflowDraft, subscribeToShortcutWorkflowReturn } from "./shortcutWorkflowDraft";
import { api, APIError } from "./api";
import type { ShortcutConnectionControlMode, ShortcutWorkflowSettings } from "./types";

export function ShortcutWorkflowSettingsView({ controlMode, disabled, onSaved }: {
  controlMode: ShortcutConnectionControlMode;
  disabled: boolean;
  onSaved: () => void;
}) {
  const [settings, setSettings] = useState<ShortcutWorkflowSettings>();
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const [reloadRequired, setReloadRequired] = useState(false);
  const current = useRef<{ settings?: ShortcutWorkflowSettings; selected: number[] }>({ selected: [] });
  const knownNames = useRef(new Map<number, string>());
  const refreshing = useRef(false);
  const savingRef = useRef(false);
  const mounted = useRef(true);

  function recordSettings(next: ShortcutWorkflowSettings, selection = Object.keys(next.activeStates).map(Number)) {
    for (const state of next.availableStates) knownNames.current.set(state.id, state.name);
    for (const [id, name] of Object.entries(next.activeStates)) {
      if (!knownNames.current.has(Number(id))) knownNames.current.set(Number(id), name);
    }
    current.current = { settings: next, selected: selection };
    setSettings(next);
    setSelected(selection);
  }

  function selectState(id: number, checked: boolean) {
    const next = checked ? [...current.current.selected, id] : current.current.selected.filter((value) => value !== id);
    current.current.selected = next;
    setSelected(next);
  }

  async function reload(discardDraft = false) {
    if (refreshing.current || savingRef.current) return;
    refreshing.current = true;
    setLoading(true);
    setError(undefined);
    try {
      const next = await api.shortcutWorkflowSettings();
      if (!mounted.current) return;
      const refreshed = discardDraft
        ? { settings: next, selected: Object.keys(next.activeStates).map(Number), conflict: false }
        : refreshShortcutWorkflowDraft(current.current.settings, current.current.selected, next);
      recordSettings(refreshed.settings, refreshed.selected);
      setReloadRequired(refreshed.conflict);
      if (refreshed.conflict) setError("Saved settings changed on another device. Reload saved settings to discard your draft and use the latest selection.");
    } catch (caught) {
      if (mounted.current) setError(caught instanceof Error ? caught.message : "Unable to refresh workflow states. Try again.");
    } finally {
      refreshing.current = false;
      if (mounted.current) setLoading(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    void reload();
    const unsubscribe = subscribeToShortcutWorkflowReturn(() => void reload());
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, []);

  async function save() {
    const draft = current.current;
    if (!draft.settings || refreshing.current || savingRef.current || reloadRequired) return;
    savingRef.current = true;
    setSaving(true);
    setError(undefined);
    try {
      const saved = await api.saveShortcutWorkflowSettings(draft.settings.version, draft.selected);
      if (!mounted.current) return;
      recordSettings(saved);
      setReloadRequired(false);
      onSaved();
    } catch (caught) {
      if (!mounted.current) return;
      setReloadRequired(caught instanceof APIError && caught.status === 409);
      setError(caught instanceof Error ? caught.message : "Unable to save workflow states. Try again.");
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  const dirty = settings && hasShortcutWorkflowDraft(settings, selected);
  const available = settings?.availableStates.filter((state) => state.type !== "done") ?? [];
  const missing = settings ? [...new Set([...Object.keys(settings.activeStates).map(Number), ...selected])]
    .filter((id) => !available.some((state) => state.id === id))
    .map((id) => [id, knownNames.current.get(id) ?? `State ${id}`] as const) : [];
  const completionNames = settings ? Object.entries(settings.completionStates).filter(([id]) => !selected.includes(Number(id))).map(([, name]) => name) : [];

  return <section className="shortcut-workflow-settings" aria-labelledby="shortcut-workflow-title" aria-busy={loading || saving}>
    <div className="workflow-settings-heading">
      <div>
        <h2 id="shortcut-workflow-title">Workflow states to track</h2>
        <p>Assigned Shortcut Stories in these states create or reopen Tasks. This selection applies across your devices.</p>
      </div>
      <button className="secondary-button" disabled={loading || saving} onClick={() => void reload()} type="button">{loading && settings ? "Refreshing…" : "Refresh states"}</button>
    </div>
    {loading && !settings ? <p role="status">Loading workflow states…</p> : null}
    <p className="workflow-refresh-note">Refreshes when you return to this page. New states stay unchecked, and unsaved selections are preserved.</p>
    {settings ? <>
      <fieldset disabled={disabled || saving}>
        <legend className="visually-hidden">Shortcut workflow states to track</legend>
        <div className="workflow-state-options">
          {available.map((state) => <label className="workflow-state-option" key={state.id}>
            <input type="checkbox" checked={selected.includes(state.id)} onChange={(event) => selectState(state.id, event.target.checked)} />
            <span>{state.name}<small>{state.workflowName}</small></span>
          </label>)}
          {missing.map(([id, name]) => <label className="workflow-state-option" key={id}>
            <input type="checkbox" checked={selected.includes(id)} onChange={(event) => selectState(id, event.target.checked)} />
            <span>{name}<small>No longer selectable. Uncheck to remove.</small></span>
          </label>)}
        </div>
      </fieldset>
      <p className="workflow-settings-note">Unchecking a state archives its open Tasks on the next reconciliation, unless that state is a completion signal. Selecting it again can reopen them.</p>
      <details className="workflow-completion-states">
        <summary>Completion signals</summary>
        <p>{completionNames.join(", ") || "No completion states outside your selection."}</p>
        <p>A selected state creates or reopens Tasks instead of completing them. Completed Stories cannot be selected.</p>
      </details>
      <div className="workflow-settings-actions">
        <button className="primary-button" disabled={!dirty || disabled || saving || loading || reloadRequired} onClick={() => void save()} type="button">{saving ? "Saving…" : "Save workflow states"}</button>
        {dirty ? <button className="secondary-button" disabled={saving} onClick={() => recordSettings(settings)} type="button">Cancel</button> : null}
        <span>{controlMode === "off" ? "Saved rules take effect after you enable Review or Automatic." : controlMode === "review" ? "Save, then Preview and approve changes." : "Save, then Sync now, or wait for automatic reconciliation."}</span>
      </div>
    </> : null}
    {error ? <div role="alert" className="workflow-settings-error"><p>{error}</p><button className="secondary-button" disabled={loading || saving} onClick={() => void reload(reloadRequired)} type="button">{reloadRequired ? "Reload saved settings" : "Retry refresh"}</button></div> : null}
  </section>;
}

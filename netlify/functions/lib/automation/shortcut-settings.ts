import { z } from "zod";
import { database } from "../database.js";
import { HttpError } from "../http.js";
import { ShortcutClient, type ShortcutWorkflowState } from "./shortcut-client.js";
import { DIRECT_SHORTCUT_RULE_ID, type ShortcutRuleSettings } from "./shortcut-rule.js";

const stateMapSchema = z.record(z.string().regex(/^[1-9]\d*$/u), z.string().trim().min(1));
const storedConfigSchema = z.object({ active_states: stateMapSchema, completion_states: stateMapSchema });

export const shortcutSettingsSchema = z.object({
  expectedVersion: z.number().int().positive(),
  activeStateIds: z.array(z.number().int().positive()).max(200),
}).strict();

export type ShortcutWorkflowSettings = ShortcutRuleSettings & { availableStates: ShortcutWorkflowState[] };

export function ruleSettingsFromRow(row: { version: number; config: unknown }): ShortcutRuleSettings {
  const config = storedConfigSchema.parse(row.config);
  return { version: row.version, activeStates: config.active_states, completionStates: config.completion_states };
}

export async function loadShortcutRuleSettings(): Promise<ShortcutRuleSettings> {
  const sql = database();
  const rows = await sql`
    SELECT version, config FROM automation_rule_versions
    WHERE rule_id = ${DIRECT_SHORTCUT_RULE_ID} AND status = 'active'
  `;
  if (!rows[0]) throw new HttpError(503, "Shortcut Rule is not configured. Apply migration 0003.");
  return ruleSettingsFromRow(rows[0] as { version: number; config: unknown });
}

export async function loadShortcutWorkflowSettings(): Promise<ShortcutWorkflowSettings> {
  const [rule, availableStates] = await Promise.all([
    loadShortcutRuleSettings(), new ShortcutClient().workflowStates(),
  ]);
  return settingsWithCurrentNames(rule, availableStates);
}

function settingsWithCurrentNames(rule: ShortcutRuleSettings, availableStates: ShortcutWorkflowState[]): ShortcutWorkflowSettings {
  const names = new Map(availableStates.map((state) => [String(state.id), state.name]));
  const currentNames = (states: Record<string, string>) => Object.fromEntries(
    Object.entries(states).map(([id, name]) => [id, names.get(id) ?? name]),
  );
  return { ...rule, activeStates: currentNames(rule.activeStates), completionStates: currentNames(rule.completionStates), availableStates };
}

export function resolveShortcutRuleSettings(rule: ShortcutRuleSettings, availableStates: ShortcutWorkflowState[]): ShortcutRuleSettings {
  const byId = new Map(availableStates.map((state) => [String(state.id), state]));
  const activeStates = Object.fromEntries(Object.keys(rule.activeStates).flatMap((id) => {
    const state = byId.get(id);
    return state && state.type !== "done" ? [[id, state.name]] : [];
  }));
  const completionStates = Object.fromEntries(Object.keys(rule.completionStates).flatMap((id) => {
    const state = byId.get(id);
    return state && !Object.hasOwn(activeStates, id) ? [[id, state.name]] : [];
  }));
  return {
    ...rule, activeStates, completionStates,
    stateNames: {
      ...rule.activeStates, ...rule.completionStates,
      ...Object.fromEntries(availableStates.map((state) => [state.id, state.name])),
    },
  };
}

export async function loadCurrentShortcutRuleSettings(): Promise<ShortcutRuleSettings> {
  const [rule, availableStates] = await Promise.all([
    loadShortcutRuleSettings(), new ShortcutClient().workflowStates(),
  ]);
  return resolveShortcutRuleSettings(rule, availableStates);
}

export function selectedShortcutStates(ids: number[], availableStates: ShortcutWorkflowState[]): Record<string, string> {
  const selected: Record<string, string> = {};
  for (const id of new Set(ids)) {
    const state = availableStates.find((candidate) => candidate.id === id);
    if (!state || state.type === "done") {
      throw new HttpError(400, "Choose current, unfinished Shortcut workflow states. Reload the settings and try again.");
    }
    selected[id] = state.name;
  }
  return selected;
}

export async function updateShortcutWorkflowSettings(input: z.infer<typeof shortcutSettingsSchema>): Promise<ShortcutWorkflowSettings> {
  const availableStates = await new ShortcutClient().workflowStates();
  const activeStates = selectedShortcutStates(input.activeStateIds, availableStates);
  const sql = database();
  // Retire and insert in one statement. The version check prevents stale clients
  // from overwriting a newer selection. Proposed shadow versions remain untouched.
  const results = await sql.transaction((tx) => [
    tx`SELECT pg_advisory_xact_lock(hashtext('todo-trackr-shortcut-reconciliation'))`,
    tx`
      WITH retired AS (
        UPDATE automation_rule_versions SET status = 'retired'
        WHERE rule_id = ${DIRECT_SHORTCUT_RULE_ID} AND status = 'active'
          AND version = ${input.expectedVersion}
        RETURNING config
      )
      INSERT INTO automation_rule_versions (rule_id, version, status, config, activated_at)
      SELECT ${DIRECT_SHORTCUT_RULE_ID},
        (SELECT COALESCE(MAX(version), 0) + 1 FROM automation_rule_versions WHERE rule_id = ${DIRECT_SHORTCUT_RULE_ID}),
        'active', jsonb_set(retired.config, '{active_states}', ${JSON.stringify(activeStates)}::jsonb), now()
      FROM retired
      RETURNING version, config
    `,
  ]);
  const row = results[1]?.[0];
  if (!row) throw new HttpError(409, "Shortcut settings changed on another device. Reload the settings before saving.");
  return settingsWithCurrentNames(ruleSettingsFromRow(row as { version: number; config: unknown }), availableStates);
}

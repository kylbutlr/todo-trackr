import { randomUUID } from "node:crypto";

import { database } from "../database.js";
import { HttpError } from "../http.js";
import { DIRECT_SHORTCUT_RULE_ID } from "./shortcut-rule.js";
import {
  SHORTCUT_RULE_V2_VERSION,
  type ShortcutResponsibilityReason,
  type ShortcutRuleV2Outcome,
  type ShortcutRuleV2Salience,
  type ShortcutRuleV2ShadowItem,
} from "./shortcut-rule-v2.js";

type ShadowRow = {
  external_reference: string;
  source_url: string;
  title: string;
  workflow_state_name: string;
  outcome: ShortcutRuleV2Outcome;
  salience: ShortcutRuleV2Salience;
  reasons: ShortcutResponsibilityReason[];
  reason_summary: string;
  fingerprint: string;
  source_updated_at: Date | string | null;
  observed_at: Date | string;
};

export type ShortcutRuleV2ObservedItem = ShortcutRuleV2ShadowItem & {
  observedAt: string;
};

export type ShortcutRuleV2ShadowSnapshot = {
  mode: "shadow";
  ruleVersion: 2;
  generatedAt: string;
  coverageStartedAt: string | null;
  mutatesTasks: false;
  counts: Record<ShortcutRuleV2Outcome | ShortcutRuleV2Salience, number>;
  items: ShortcutRuleV2ObservedItem[];
};

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function nullableIso(value: Date | string | null): string | null {
  return value === null ? null : iso(value);
}

function serialize(row: ShadowRow): ShortcutRuleV2ObservedItem {
  return {
    externalReference: row.external_reference,
    sourceUrl: row.source_url,
    title: row.title,
    workflowStateName: row.workflow_state_name,
    outcome: row.outcome,
    salience: row.salience,
    reasons: row.reasons,
    reasonSummary: row.reason_summary,
    sourceUpdatedAt: nullableIso(row.source_updated_at),
    fingerprint: row.fingerprint,
    observedAt: iso(row.observed_at),
  };
}

export async function recordShortcutRuleV2Shadow(items: ShortcutRuleV2ShadowItem[]): Promise<void> {
  try {
    const sql = database();
    for (const item of items) {
      const latest = (await sql`
        SELECT fingerprint
        FROM automation_rule_shadow_observations
        WHERE rule_id = ${DIRECT_SHORTCUT_RULE_ID}
          AND rule_version = ${SHORTCUT_RULE_V2_VERSION}
          AND external_reference = ${item.externalReference}
        ORDER BY observed_at DESC
        LIMIT 1
      `) as Array<{ fingerprint: string }>;
      if (latest[0]?.fingerprint === item.fingerprint) continue;
      if (!latest[0] && item.reasons.length === 0) continue;

      await sql`
        INSERT INTO automation_rule_shadow_observations (
          id, rule_id, rule_version, external_reference, source_url, title,
          workflow_state_name, outcome, salience, reasons, reason_summary,
          fingerprint, source_updated_at
        ) VALUES (
          ${randomUUID()}, ${DIRECT_SHORTCUT_RULE_ID}, ${SHORTCUT_RULE_V2_VERSION},
          ${item.externalReference}, ${item.sourceUrl}, ${item.title},
          ${item.workflowStateName}, ${item.outcome}, ${item.salience},
          ${JSON.stringify(item.reasons)}::jsonb, ${item.reasonSummary},
          ${item.fingerprint}, ${item.sourceUpdatedAt}
        )
      `;
    }
  } catch (error) {
    if (error instanceof Error && /automation_rule_shadow_observations|automation_rule_versions/u.test(error.message)) {
      throw new HttpError(503, "Shortcut Rule v2 shadow storage is unavailable. Apply migration 0008.");
    }
    throw error;
  }
}

export async function loadShortcutRuleV2Shadow(): Promise<ShortcutRuleV2ShadowSnapshot> {
  try {
    const sql = database();
    const rows = (await sql`
      SELECT DISTINCT ON (external_reference)
        external_reference, source_url, title, workflow_state_name, outcome,
        salience, reasons, reason_summary, fingerprint, source_updated_at, observed_at
      FROM automation_rule_shadow_observations
      WHERE rule_id = ${DIRECT_SHORTCUT_RULE_ID}
        AND rule_version = ${SHORTCUT_RULE_V2_VERSION}
      ORDER BY external_reference, observed_at DESC
    `) as ShadowRow[];
    const items = rows.map(serialize).sort((left, right) => {
      const salienceOrder = { primary: 0, heads_up: 1, background: 2 } as const;
      return salienceOrder[left.salience] - salienceOrder[right.salience]
        || Date.parse(right.observedAt) - Date.parse(left.observedAt);
    });
    const observedTimes = items.map(({ observedAt }) => Date.parse(observedAt));
    const values = ["open", "hold", "complete", "ignore", "primary", "heads_up", "background"] as const;
    const counts = Object.fromEntries(values.map((value) => [
      value,
      items.filter((item) => item.outcome === value || item.salience === value).length,
    ])) as ShortcutRuleV2ShadowSnapshot["counts"];

    return {
      mode: "shadow",
      ruleVersion: SHORTCUT_RULE_V2_VERSION,
      generatedAt: new Date().toISOString(),
      coverageStartedAt: observedTimes.length > 0 ? new Date(Math.min(...observedTimes)).toISOString() : null,
      mutatesTasks: false,
      counts,
      items,
    };
  } catch (error) {
    if (error instanceof Error && /automation_rule_shadow_observations|automation_rule_versions/u.test(error.message)) {
      throw new HttpError(503, "Shortcut Rule v2 shadow storage is unavailable. Apply migration 0008.");
    }
    throw error;
  }
}

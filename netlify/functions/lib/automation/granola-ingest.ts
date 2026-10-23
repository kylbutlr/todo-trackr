import { createHash, randomUUID } from "node:crypto";

import { z } from "zod";

import { database } from "../database.js";
import { INBOX_LIST_ID } from "../lists.js";
import { KYLE_SHORTCUT_MEMBER_ID } from "./shortcut-rule.js";

export const GRANOLA_CONNECTION_ID = "00000000-0000-4000-8000-000000000200";
export const GRANOLA_RULE_ID = "00000000-0000-4000-8000-000000000210";
export const GRANOLA_RULE_VERSION = 1;

const sourceUrlSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Source URL must use HTTP or HTTPS.");

export const granolaActionSchema = z.object({
  externalReference: z.string().trim().min(1).max(500),
  title: z.string().trim().min(1).max(500),
  notes: z.string().max(10_000).default(""),
  sourceUrl: sourceUrlSchema,
  sourceExcerpt: z.string().trim().min(1).max(2_000).nullable().default(null),
  dueAt: z.iso.datetime({ offset: true }).nullable().default(null),
  sourceUpdatedAt: z.iso.datetime({ offset: true }).nullable().default(null),
});

export const granolaIngestSchema = z.object({
  actions: z.array(granolaActionSchema).min(1).max(50),
});

export type GranolaIngestInput = z.infer<typeof granolaIngestSchema>;
export type GranolaIngestResult = {
  received: number;
  created: number;
  skipped: number;
};

export type GranolaIngestOptions = {
  trigger?: "manual" | "webhook";
  counts?: Record<string, number>;
};

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function ingestGranolaActions(
  input: GranolaIngestInput,
  options: GranolaIngestOptions = {},
): Promise<GranolaIngestResult> {
  const sql = database();
  const runId = randomUUID();
  const received = input.actions.length;
  const trigger = options.trigger ?? "manual";
  const initialCounts = JSON.stringify({ ...options.counts, received, created: 0 });

  const results = await sql.transaction((tx) => {
    const queries = [
      tx`
        INSERT INTO connection_sync_runs (id, connection_id, trigger, mode, status, counts)
        VALUES (
          ${runId}, ${GRANOLA_CONNECTION_ID}, ${trigger}, 'apply', 'running',
          ${initialCounts}::jsonb
        )
      `,
    ];

    for (const action of input.actions) {
      const sourceObjectId = randomUUID();
      const taskId = randomUUID();
      const activityId = randomUUID();
      const contentFingerprint = fingerprint({ title: action.title, excerpt: action.sourceExcerpt });
      const sourceFingerprint = fingerprint({
        contentFingerprint,
        dueAt: action.dueAt,
        sourceUpdatedAt: action.sourceUpdatedAt,
      });
      const dueDate = action.dueAt?.slice(0, 10) ?? null;
      const ownerIds = `{${KYLE_SHORTCUT_MEMBER_ID}}`;
      const observation = JSON.stringify({
        externalReference: action.externalReference,
        sourceUpdatedAt: action.sourceUpdatedAt,
      });

      queries.push(tx`
        WITH upserted_source AS (
          INSERT INTO source_objects (
            id, connection_id, external_reference, source_url, title,
            content_fingerprint, source_fingerprint, source_summary,
            source_summary_fingerprint, priority, due_date, owner_ids,
            workflow_state_name, source_updated_at, observed_at, updated_at
          ) VALUES (
            ${sourceObjectId}, ${GRANOLA_CONNECTION_ID}, ${action.externalReference}, ${action.sourceUrl}, ${action.title},
            ${contentFingerprint}, ${sourceFingerprint}, ${action.sourceExcerpt},
            ${action.sourceExcerpt ? contentFingerprint : null}, 'none', ${dueDate}, ${ownerIds}::uuid[],
            'Next step', ${action.sourceUpdatedAt}, now(), now()
          )
          ON CONFLICT (connection_id, external_reference) DO UPDATE SET
            source_url = EXCLUDED.source_url,
            title = EXCLUDED.title,
            content_fingerprint = EXCLUDED.content_fingerprint,
            source_fingerprint = EXCLUDED.source_fingerprint,
            source_summary = EXCLUDED.source_summary,
            source_summary_fingerprint = EXCLUDED.source_summary_fingerprint,
            due_date = EXCLUDED.due_date,
            source_updated_at = EXCLUDED.source_updated_at,
            observed_at = now(),
            updated_at = now()
          RETURNING id
        ), created_task AS (
          INSERT INTO tasks (
            id, title, notes, status, priority, due_at, list_id, source, source_url
          )
          SELECT
            ${taskId}, ${action.title}, ${action.notes}, 'open', 'none', ${action.dueAt},
            ${INBOX_LIST_ID}, 'granola', ${action.sourceUrl}
          FROM upserted_source
          WHERE NOT EXISTS (
            SELECT 1
            FROM automated_task_links AS links
            WHERE links.source_object_id = upserted_source.id
              AND links.rule_id = ${GRANOLA_RULE_ID}
          )
          RETURNING id
        ), created_link AS (
          INSERT INTO automated_task_links (task_id, source_object_id, rule_id, rule_version)
          SELECT created_task.id, upserted_source.id, ${GRANOLA_RULE_ID}, ${GRANOLA_RULE_VERSION}
          FROM created_task CROSS JOIN upserted_source
          RETURNING task_id
        ), activity AS (
          INSERT INTO automation_activity (
            id, task_id, connection_id, rule_id, rule_version, action, reason, source_observation
          )
          SELECT
            ${activityId}, task_id, ${GRANOLA_CONNECTION_ID}, ${GRANOLA_RULE_ID},
            ${GRANOLA_RULE_VERSION}, 'created', 'Granola identified a next step for Kyle.', ${observation}::jsonb
          FROM created_link
        ), bumped AS (
          UPDATE connection_sync_runs
          SET counts = jsonb_set(
            counts,
            '{created}',
            to_jsonb(COALESCE((counts->>'created')::integer, 0) + (SELECT count(*) FROM created_link))
          )
          WHERE id = ${runId}
        )
        SELECT task_id FROM created_link
      `);
    }

    queries.push(tx`
      UPDATE connection_sync_runs
      SET
        status = 'succeeded',
        counts = counts || jsonb_build_object(
          'skipped',
          (counts->>'received')::integer - (counts->>'created')::integer
        ),
        finished_at = now()
      WHERE id = ${runId}
      RETURNING counts
    `);
    queries.push(tx`
      UPDATE source_connections
      SET health = 'healthy', last_success_at = now(), updated_at = now()
      WHERE id = ${GRANOLA_CONNECTION_ID}
    `);
    return queries;
  });

  const finalRun = results.at(-2)?.[0] as { counts?: Record<string, number> } | undefined;
  const created = Number(finalRun?.counts?.created ?? 0);
  return { received, created, skipped: received - created };
}

import { randomUUID } from "node:crypto";

import { database } from "../database.js";
import { HttpError } from "../http.js";
import { INBOX_LIST_ID } from "../lists.js";
import {
  DIRECT_SHORTCUT_RULE_ID,
  DIRECT_SHORTCUT_RULE_VERSION,
  SHORTCUT_CONNECTION_ID,
  type ExistingShortcutTask,
  type ShortcutPreviewItem,
} from "./shortcut-rule.js";

export type ShortcutConnectionSnapshot = {
  id: string;
  name: string;
  paused: boolean;
  syncMode: ShortcutSyncMode;
  controlMode: ShortcutConnectionControlMode;
  health: "healthy" | "syncing" | "degraded" | "failed" | "paused";
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
  lastWebhookAt: string | null;
  lastFullSyncAt: string | null;
  nextRepairAt: string | null;
  repairIntervalSeconds: number;
};

export type ShortcutSyncRun = {
  id: string;
  trigger: ShortcutSyncTrigger;
  status: "running" | "succeeded" | "failed";
  counts: Record<string, number>;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type ShortcutAutomationActivity = {
  id: string;
  taskId: string;
  taskTitle: string;
  externalReference: string | null;
  action: "created" | "updated" | "completed" | "reopened" | "archived";
  reason: string;
  ruleVersion: number;
  sourceObservation: Record<string, unknown>;
  createdAt: string;
};

export type ShortcutDiagnostics = {
  connection: ShortcutConnectionSnapshot;
  syncRuns: ShortcutSyncRun[];
  activity: ShortcutAutomationActivity[];
};

export type ShortcutSyncMode = "review" | "automatic";
export type ShortcutConnectionControlMode = "off" | ShortcutSyncMode;
export type ShortcutSyncTrigger = "manual" | "webhook" | "poll" | "scheduled" | "resume" | "rule_change";
export type ShortcutSyncFailureState = {
  health: "degraded" | "failed";
  consecutiveFailures: number;
  shouldNotify: boolean;
  message: string;
};

type ConnectionRow = {
  id: string;
  name: string;
  paused: boolean;
  sync_mode: ShortcutSyncMode;
  health: ShortcutConnectionSnapshot["health"];
  last_success_at: Date | string | null;
  last_failure_at: Date | string | null;
  last_failure_message: string | null;
  last_webhook_at: Date | string | null;
  last_full_sync_at: Date | string | null;
};

type SyncRunRow = {
  id: string;
  trigger: ShortcutSyncTrigger;
  status: ShortcutSyncRun["status"];
  counts: Record<string, number> | null;
  error_message: string | null;
  started_at: Date | string;
  finished_at: Date | string | null;
};

type AutomationActivityRow = {
  id: string;
  task_id: string;
  task_title: string;
  external_reference: string | null;
  action: ShortcutAutomationActivity["action"];
  reason: string;
  rule_version: number;
  source_observation: Record<string, unknown>;
  created_at: Date | string;
};

export const SHORTCUT_REPAIR_INTERVAL_SECONDS = 6 * 60 * 60;
export const SHORTCUT_REPAIR_MINUTE = 17;

export function nextShortcutRepairAt(now: Date = new Date()): string {
  const intervalMs = SHORTCUT_REPAIR_INTERVAL_SECONDS * 1_000;
  const minuteOffsetMs = SHORTCUT_REPAIR_MINUTE * 60 * 1_000;
  const shiftedNow = now.getTime() - minuteOffsetMs;
  return new Date((Math.floor(shiftedNow / intervalMs) + 1) * intervalMs + minuteOffsetMs).toISOString();
}

type ExistingTaskRow = {
  task_id: string;
  external_reference: string;
  status: "open" | "completed" | "archived";
  source_fingerprint: string;
  source_summary_fingerprint: string | null;
  source_summary: string | null;
};

function nullableIso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function serializeConnection(connection: ConnectionRow): ShortcutConnectionSnapshot {
  return {
    id: connection.id,
    name: connection.name,
    paused: connection.paused,
    syncMode: connection.sync_mode,
    controlMode: connection.paused ? "off" : connection.sync_mode,
    health: connection.health,
    lastSuccessAt: nullableIso(connection.last_success_at),
    lastFailureAt: nullableIso(connection.last_failure_at),
    lastFailureMessage: connection.last_failure_message,
    lastWebhookAt: nullableIso(connection.last_webhook_at),
    lastFullSyncAt: nullableIso(connection.last_full_sync_at),
    nextRepairAt: connection.paused || connection.sync_mode !== "automatic" ? null : nextShortcutRepairAt(),
    repairIntervalSeconds: SHORTCUT_REPAIR_INTERVAL_SECONDS,
  };
}

export async function loadShortcutConnection(): Promise<ShortcutConnectionSnapshot> {
  try {
    const sql = database();
    const connections = (await sql`
      SELECT
        connections.id,
        connections.name,
        connections.paused,
        connections.sync_mode,
        connections.health,
        connections.last_success_at,
        connections.last_failure_at,
        connections.last_failure_message,
        (
          SELECT MAX(runs.finished_at)
          FROM connection_sync_runs AS runs
          WHERE runs.connection_id = connections.id
            AND runs.trigger = 'webhook'
            AND runs.status = 'succeeded'
        ) AS last_webhook_at,
        (
          SELECT MAX(runs.finished_at)
          FROM connection_sync_runs AS runs
          WHERE runs.connection_id = connections.id
            AND runs.trigger IN ('manual', 'scheduled', 'resume')
            AND runs.status = 'succeeded'
        ) AS last_full_sync_at
      FROM source_connections AS connections
      WHERE connections.source = 'shortcut'
    `) as ConnectionRow[];
    if (!connections[0]) {
      throw new HttpError(503, "Shortcut Connection is not configured. Apply migration 0003.");
    }
    return serializeConnection(connections[0]);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Error && /source_connections|connection_sync_runs/u.test(error.message)) {
      throw new HttpError(503, "Shortcut automation tables are unavailable. Apply migrations through 0006.");
    }
    throw error;
  }
}

export async function loadShortcutPreviewContext(): Promise<{
  connection: ShortcutConnectionSnapshot;
  existingTasks: ExistingShortcutTask[];
}> {
  try {
    const sql = database();
    const connection = await loadShortcutConnection();

    const rows = (await sql`
      SELECT
        links.task_id,
        source.external_reference,
        tasks.status,
        source.source_fingerprint,
        source.source_summary_fingerprint,
        source.source_summary
      FROM automated_task_links AS links
      JOIN source_objects AS source ON source.id = links.source_object_id
      JOIN tasks ON tasks.id = links.task_id
      WHERE source.connection_id = ${connection.id}
    `) as ExistingTaskRow[];

    return {
      connection,
      existingTasks: rows.map((row) => ({
        taskId: row.task_id,
        externalReference: row.external_reference,
        lifecycle: row.status,
        sourceFingerprint: row.source_fingerprint,
        summaryFingerprint: row.source_summary_fingerprint,
        sourceSummary: row.source_summary,
      })),
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Error && /source_connections|source_objects|automated_task_links/u.test(error.message)) {
      throw new HttpError(503, "Shortcut automation tables are unavailable. Apply migration 0003.");
    }
    throw error;
  }
}

export async function loadShortcutDiagnostics(limit = 12): Promise<ShortcutDiagnostics> {
  const connection = await loadShortcutConnection();
  const sql = database();
  const boundedLimit = Math.max(1, Math.min(limit, 50));
  const [syncRuns, activity] = await Promise.all([
    sql`
      SELECT id, trigger, status, counts, error_message, started_at, finished_at
      FROM connection_sync_runs
      WHERE connection_id = ${SHORTCUT_CONNECTION_ID}
        AND started_at >= now() - interval '90 days'
      ORDER BY started_at DESC
      LIMIT ${boundedLimit}
    ` as unknown as Promise<SyncRunRow[]>,
    sql`
      SELECT
        activity.id,
        activity.task_id,
        tasks.title AS task_title,
        source.external_reference,
        activity.action,
        activity.reason,
        activity.rule_version,
        activity.source_observation,
        activity.created_at
      FROM automation_activity AS activity
      JOIN tasks ON tasks.id = activity.task_id
      LEFT JOIN automated_task_links AS links ON links.task_id = tasks.id
      LEFT JOIN source_objects AS source ON source.id = links.source_object_id
      WHERE activity.connection_id = ${SHORTCUT_CONNECTION_ID}
      ORDER BY activity.created_at DESC
      LIMIT ${boundedLimit}
    ` as unknown as Promise<AutomationActivityRow[]>,
  ]);

  return {
    connection,
    syncRuns: syncRuns.map((row) => ({
      id: row.id,
      trigger: row.trigger,
      status: row.status,
      counts: row.counts ?? {},
      errorMessage: row.error_message,
      startedAt: iso(row.started_at),
      finishedAt: nullableIso(row.finished_at),
    })),
    activity: activity.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      taskTitle: row.task_title,
      externalReference: row.external_reference,
      action: row.action,
      reason: row.reason,
      ruleVersion: row.rule_version,
      sourceObservation: row.source_observation,
      createdAt: iso(row.created_at),
    })),
  };
}

export async function loadTaskAutomationActivity(
  taskId: string,
  limit = 10,
): Promise<ShortcutAutomationActivity[]> {
  const sql = database();
  const boundedLimit = Math.max(1, Math.min(limit, 50));
  const rows = (await sql`
    SELECT
      activity.id,
      activity.task_id,
      tasks.title AS task_title,
      source.external_reference,
      activity.action,
      activity.reason,
      activity.rule_version,
      activity.source_observation,
      activity.created_at
    FROM automation_activity AS activity
    JOIN tasks ON tasks.id = activity.task_id
    LEFT JOIN automated_task_links AS links ON links.task_id = tasks.id
    LEFT JOIN source_objects AS source ON source.id = links.source_object_id
    WHERE activity.task_id = ${taskId}
    ORDER BY activity.created_at DESC
    LIMIT ${boundedLimit}
  `) as AutomationActivityRow[];
  return rows.map((row) => ({
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    externalReference: row.external_reference,
    action: row.action,
    reason: row.reason,
    ruleVersion: row.rule_version,
    sourceObservation: row.source_observation,
    createdAt: iso(row.created_at),
  }));
}

export async function updateShortcutConnectionMode(
  mode: ShortcutConnectionControlMode,
): Promise<ShortcutConnectionSnapshot> {
  const sql = database();
  const paused = mode === "off";
  const syncMode: ShortcutSyncMode | null = mode === "off" ? null : mode;
  await sql`
    UPDATE source_connections
    SET
      paused = ${paused},
      sync_mode = COALESCE(${syncMode}, sync_mode),
      health = ${paused ? "paused" : mode === "automatic" ? "syncing" : "healthy"},
      last_failure_message = CASE WHEN ${paused} THEN last_failure_message ELSE NULL END,
      updated_at = now()
    WHERE id = ${SHORTCUT_CONNECTION_ID}
  `;
  return loadShortcutConnection();
}

export async function claimShortcutWebhookEvent(eventId: string, storyReferences: string[]): Promise<boolean> {
  const sql = database();
  const references = `{${storyReferences.join(",")}}`;
  const rows = await sql`
    INSERT INTO source_webhook_events (id, connection_id, status, story_references)
    VALUES (${eventId}, ${SHORTCUT_CONNECTION_ID}, 'processing', ${references}::text[])
    ON CONFLICT (id) DO UPDATE SET
      status = 'processing', error_message = NULL, processed_at = NULL, received_at = now()
    WHERE source_webhook_events.status = 'failed'
       OR (source_webhook_events.status = 'processing' AND source_webhook_events.received_at < now() - interval '10 minutes')
    RETURNING id
  `;
  return rows.length > 0;
}

export async function finishShortcutWebhookEvent(
  eventId: string,
  status: "succeeded" | "ignored" | "failed",
  errorMessage: string | null = null,
): Promise<void> {
  const sql = database();
  await sql`
    UPDATE source_webhook_events
    SET status = ${status}, error_message = ${errorMessage}, processed_at = now()
    WHERE id = ${eventId}
  `;
}

export async function recordShortcutSyncFailure(
  error: unknown,
  trigger: ShortcutSyncTrigger = "manual",
): Promise<ShortcutSyncFailureState> {
  const message = error instanceof Error ? error.message : "Unexpected Shortcut synchronization failure.";
  const configurationFailure = /authentication failed|missing required environment variable/iu.test(message);
  const sql = database();
  const rows = (await sql`
    UPDATE source_connections
    SET
      consecutive_failures = consecutive_failures + 1,
      health = CASE WHEN ${configurationFailure} OR consecutive_failures + 1 >= 3 THEN 'failed' ELSE 'degraded' END,
      last_failure_at = now(),
      last_failure_message = ${message},
      updated_at = now()
    WHERE id = ${SHORTCUT_CONNECTION_ID}
    RETURNING consecutive_failures, health
  `) as Array<{ consecutive_failures: number; health: "degraded" | "failed" }>;
  await sql`
    INSERT INTO connection_sync_runs (id, connection_id, trigger, mode, status, error_message, finished_at)
    VALUES (${randomUUID()}, ${SHORTCUT_CONNECTION_ID}, ${trigger}, 'apply', 'failed', ${message}, now())
  `;
  const state = rows[0] ?? { consecutive_failures: 1, health: "degraded" as const };
  return {
    health: state.health,
    consecutiveFailures: Number(state.consecutive_failures),
    shouldNotify: configurationFailure || Number(state.consecutive_failures) === 3,
    message,
  };
}

function dateOnlyDueAt(dueDate: string | null): string | null {
  return dueDate ? `${dueDate}T12:00:00.000Z` : null;
}

export async function applyShortcutReconciliation(
  items: ShortcutPreviewItem[],
  trigger: ShortcutSyncTrigger = "manual",
): Promise<void> {
  for (const item of items) {
    if (item.action === "ignore") {
      throw new HttpError(400, "No-change Shortcut items cannot be applied.");
    }
    if (item.action !== "create" && !item.taskId) {
      throw new HttpError(409, `Shortcut Task ${item.externalReference} is no longer linked. Refresh the preview.`);
    }
  }

  const sql = database();
  const runId = randomUUID();
  const counts = JSON.stringify(Object.fromEntries(
    ["create", "update", "complete", "reopen", "archive"].map((action) => [
      action,
      items.filter((item) => item.action === action).length,
    ]),
  ));

  const ruleVersion = items[0]?.ruleVersion ?? DIRECT_SHORTCUT_RULE_VERSION;
  if (items.some((item) => (item.ruleVersion ?? DIRECT_SHORTCUT_RULE_VERSION) !== ruleVersion)) {
    throw new HttpError(409, "Shortcut rule versions changed. Refresh before applying changes.");
  }
  await sql.transaction((tx) => {
    const queries = [
      tx`SELECT pg_advisory_xact_lock(hashtext('todo-trackr-shortcut-reconciliation'))`,
      tx`
        INSERT INTO connection_sync_runs (id, connection_id, trigger, mode, status)
        VALUES (${runId}, ${SHORTCUT_CONNECTION_ID}, ${trigger}, 'apply',
          CASE WHEN ${items.length === 0} OR EXISTS (
            SELECT 1 FROM automation_rule_versions
            WHERE rule_id = ${DIRECT_SHORTCUT_RULE_ID} AND version = ${ruleVersion} AND status = 'active'
          ) THEN 'running' ELSE NULL END)
        -- A stale rule deliberately fails the NOT NULL constraint, rolling back
        -- the entire reconciliation under the same lock used by settings saves.
      `,
    ];

    for (const item of items) {
      const sourceObjectId = randomUUID();
      const taskId = item.taskId ?? randomUUID();
      const activityId = randomUUID();
      const ownerIds = `{${item.ownerIds.join(",")}}`;
      const summaryFingerprint = item.sourceSummary ? item.contentFingerprint : null;
      const dueAt = dateOnlyDueAt(item.dueDate);
      const preserveUnavailableDetails = item.workflowStateName === "Unavailable";
      const observation = JSON.stringify({
        externalReference: item.externalReference,
        sourceFingerprint: item.sourceFingerprint,
        workflowStateId: item.workflowStateId,
        workflowStateName: item.workflowStateName,
        epicId: item.epicId,
        epicName: item.epicName,
        sourceUpdatedAt: item.sourceUpdatedAt,
      });

      queries.push(tx`
        INSERT INTO source_objects (
          id, connection_id, external_reference, source_url, title,
          content_fingerprint, source_fingerprint, source_summary,
          source_summary_fingerprint, priority, size, due_date, owner_ids,
          workflow_state_id, workflow_state_name, epic_id, epic_name, source_archived,
          source_updated_at, observed_at, updated_at
        ) VALUES (
          ${sourceObjectId}, ${SHORTCUT_CONNECTION_ID}, ${item.externalReference}, ${item.sourceUrl}, ${item.title},
          ${item.contentFingerprint}, ${item.sourceFingerprint}, ${item.sourceSummary},
          ${summaryFingerprint}, ${item.priority}, ${item.size}, ${item.dueDate}, ${ownerIds}::uuid[],
          ${item.workflowStateId}, ${item.workflowStateName}, ${item.epicId}, ${item.epicName}, ${item.archived},
          ${item.sourceUpdatedAt}, now(), now()
        )
        ON CONFLICT (connection_id, external_reference) DO UPDATE SET
          source_url = CASE WHEN ${preserveUnavailableDetails} THEN source_objects.source_url ELSE EXCLUDED.source_url END,
          title = CASE WHEN ${preserveUnavailableDetails} THEN source_objects.title ELSE EXCLUDED.title END,
          content_fingerprint = CASE WHEN ${preserveUnavailableDetails} THEN source_objects.content_fingerprint ELSE EXCLUDED.content_fingerprint END,
          source_fingerprint = EXCLUDED.source_fingerprint,
          source_summary = CASE WHEN ${preserveUnavailableDetails} THEN source_objects.source_summary ELSE EXCLUDED.source_summary END,
          source_summary_fingerprint = CASE WHEN ${preserveUnavailableDetails} THEN source_objects.source_summary_fingerprint ELSE EXCLUDED.source_summary_fingerprint END,
          priority = CASE WHEN ${preserveUnavailableDetails} THEN source_objects.priority ELSE EXCLUDED.priority END,
          size = CASE WHEN ${preserveUnavailableDetails} THEN source_objects.size ELSE EXCLUDED.size END,
          due_date = CASE WHEN ${preserveUnavailableDetails} THEN source_objects.due_date ELSE EXCLUDED.due_date END,
          owner_ids = CASE WHEN ${preserveUnavailableDetails} THEN source_objects.owner_ids ELSE EXCLUDED.owner_ids END,
          workflow_state_id = EXCLUDED.workflow_state_id,
          workflow_state_name = EXCLUDED.workflow_state_name,
          epic_id = CASE WHEN ${preserveUnavailableDetails} THEN source_objects.epic_id ELSE EXCLUDED.epic_id END,
          epic_name = CASE WHEN ${preserveUnavailableDetails} THEN source_objects.epic_name ELSE EXCLUDED.epic_name END,
          source_archived = EXCLUDED.source_archived,
          source_updated_at = EXCLUDED.source_updated_at,
          observed_at = now(),
          updated_at = now()
      `);

      if (item.action === "create") {
        queries.push(tx`
          INSERT INTO tasks (
            id, title, notes, status, priority, due_at, list_id, source, source_url
          ) VALUES (
            ${taskId}, ${item.title}, '', 'open', ${item.priority}, ${dueAt},
            ${INBOX_LIST_ID}, 'shortcut', ${item.sourceUrl}
          )
        `);
        queries.push(tx`
          INSERT INTO automated_task_links (task_id, source_object_id, rule_id, rule_version)
          SELECT ${taskId}, id, ${DIRECT_SHORTCUT_RULE_ID}, ${ruleVersion}
          FROM source_objects
          WHERE connection_id = ${SHORTCUT_CONNECTION_ID}
            AND external_reference = ${item.externalReference}
        `);
      } else {
        const nextStatus = item.action === "complete"
          ? "completed"
          : item.action === "reopen"
            ? "open"
            : item.action === "archive"
              ? "archived"
              : item.currentLifecycle;
        queries.push(tx`
          UPDATE tasks
          SET
            title = CASE WHEN ${preserveUnavailableDetails} THEN title ELSE ${item.title} END,
            priority = CASE WHEN ${preserveUnavailableDetails} THEN priority ELSE ${item.priority} END,
            due_at = CASE WHEN ${preserveUnavailableDetails} THEN due_at ELSE ${dueAt} END,
            source_url = CASE WHEN ${preserveUnavailableDetails} THEN source_url ELSE ${item.sourceUrl} END,
            status = ${nextStatus},
            completed_at = CASE
              WHEN ${nextStatus} = 'completed' THEN COALESCE(completed_at, now())
              ELSE NULL
            END,
            archived_at = CASE
              WHEN ${nextStatus} = 'archived' THEN COALESCE(archived_at, now())
              ELSE NULL
            END,
            updated_at = now()
          WHERE id = ${taskId}
        `);
      }

      const activityAction = item.action === "create"
        ? "created"
        : item.action === "update"
          ? "updated"
          : item.action === "complete"
            ? "completed"
            : item.action === "reopen"
              ? "reopened"
              : "archived";
      queries.push(tx`
        INSERT INTO automation_activity (
          id, task_id, connection_id, rule_id, rule_version, action, reason, source_observation
        ) VALUES (
          ${activityId}, ${taskId}, ${SHORTCUT_CONNECTION_ID}, ${DIRECT_SHORTCUT_RULE_ID},
          ${ruleVersion}, ${activityAction}, ${item.reason}, ${observation}::jsonb
        )
      `);
    }

    queries.push(tx`
      UPDATE connection_sync_runs
      SET status = 'succeeded', counts = ${counts}::jsonb, finished_at = now()
      WHERE id = ${runId}
    `);
    queries.push(tx`
      UPDATE source_connections
      SET
        health = 'healthy',
        consecutive_failures = 0,
        last_success_at = now(),
        last_failure_message = NULL,
        updated_at = now()
      WHERE id = ${SHORTCUT_CONNECTION_ID}
    `);

    return queries;
  }).catch((error: unknown) => {
    if (error && typeof error === "object"
      && "code" in error && error.code === "23502"
      && "table" in error && error.table === "connection_sync_runs"
      && "column" in error && error.column === "status") {
      throw new HttpError(409, "Shortcut settings changed after this preview. Refresh before applying changes.");
    }
    throw error;
  });
}

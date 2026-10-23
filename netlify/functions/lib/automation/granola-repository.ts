import { randomUUID } from "node:crypto";

import { database } from "../database.js";
import { HttpError } from "../http.js";
import type { GranolaActionCandidate } from "./granola-actions.js";
import {
  GRANOLA_CONNECTION_ID,
  GRANOLA_RULE_ID,
  ingestGranolaActions,
  type GranolaIngestInput,
} from "./granola-ingest.js";

export type GranolaConnectionSnapshot = {
  id: string;
  name: string;
  health: "healthy" | "syncing" | "degraded" | "failed" | "paused";
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
  nextScanAt: string;
  scanIntervalSeconds: number;
  scanIntervalMinutes: number;
  scanOffsetMinutes: number;
};

export type GranolaWebhookEvent = {
  id: string;
  status: "processing" | "succeeded" | "ignored" | "failed";
  noteId: string | null;
  detail: string | null;
  receivedAt: string;
  processedAt: string | null;
};

export type GranolaReviewCandidate = {
  id: string;
  title: string;
  sourceUrl: string;
  sourceExcerpt: string;
  sourceUpdatedAt: string | null;
  status: "pending" | "accepted" | "dismissed" | "stale";
  lastSeenAt: string;
};

export type GranolaPriorReviewDecision = {
  id: string;
  title: string;
  sourceExcerpt: string | null;
  status: "accepted" | "dismissed";
  resolvedAt: string | null;
};

export type GranolaLinkedTaskSource = {
  externalReference: string;
  title: string;
  sourceUrl: string;
};

export type GranolaSyncRun = {
  id: string;
  trigger: "manual" | "webhook" | "scheduled";
  status: "running" | "succeeded" | "failed";
  counts: Record<string, number>;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type GranolaDiagnostics = {
  connection: GranolaConnectionSnapshot;
  events: GranolaWebhookEvent[];
  pendingReviewCount: number;
  reviewCandidates: GranolaReviewCandidate[];
  syncRuns: GranolaSyncRun[];
};

type DateValue = Date | string;

export const GRANOLA_SCAN_INTERVAL_OPTIONS = [5, 10, 15, 30, 60] as const;
export const GRANOLA_DEFAULT_SCAN_INTERVAL_MINUTES = 15;
export const GRANOLA_DEFAULT_SCAN_OFFSET_MINUTES = 0;
export const GRANOLA_SCHEDULER_INTERVAL_MINUTES = 5;
export const GRANOLA_SCAN_INTERVAL_SECONDS = GRANOLA_DEFAULT_SCAN_INTERVAL_MINUTES * 60;

export function isValidGranolaSchedule(scanIntervalMinutes: number, scanOffsetMinutes: number): boolean {
  return GRANOLA_SCAN_INTERVAL_OPTIONS.includes(scanIntervalMinutes as typeof GRANOLA_SCAN_INTERVAL_OPTIONS[number])
    && Number.isInteger(scanOffsetMinutes)
    && scanOffsetMinutes >= 0
    && scanOffsetMinutes < scanIntervalMinutes
    && scanOffsetMinutes % GRANOLA_SCHEDULER_INTERVAL_MINUTES === 0;
}

function normalizedGranolaSchedule(scanIntervalMinutes?: number, scanOffsetMinutes?: number): {
  intervalMinutes: number;
  offsetMinutes: number;
} {
  const intervalMinutes = scanIntervalMinutes ?? GRANOLA_DEFAULT_SCAN_INTERVAL_MINUTES;
  const offsetMinutes = scanOffsetMinutes ?? GRANOLA_DEFAULT_SCAN_OFFSET_MINUTES;
  if (!isValidGranolaSchedule(intervalMinutes, offsetMinutes)) {
    throw new HttpError(400, "Granola scan interval must be 5, 10, 15, 30, or 60 minutes, with a five-minute offset within that interval.");
  }
  return { intervalMinutes, offsetMinutes };
}

export function nextGranolaScanAt(
  now: Date = new Date(),
  scanIntervalMinutes = GRANOLA_DEFAULT_SCAN_INTERVAL_MINUTES,
  scanOffsetMinutes = GRANOLA_DEFAULT_SCAN_OFFSET_MINUTES,
): string {
  const schedule = normalizedGranolaSchedule(scanIntervalMinutes, scanOffsetMinutes);
  const currentMinute = Math.floor(now.getTime() / 60_000);
  const candidate = new Date((currentMinute + 1) * 60_000);
  for (let step = 0; step <= 60; step += 1) {
    if (candidate.getUTCMinutes() % schedule.intervalMinutes === schedule.offsetMinutes) {
      return candidate.toISOString();
    }
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }
  throw new Error("Unable to calculate the next Granola scan.");
}

function latestGranolaScanSlotAtOrBefore(
  now: Date,
  scanIntervalMinutes: number,
  scanOffsetMinutes: number,
): Date {
  const schedule = normalizedGranolaSchedule(scanIntervalMinutes, scanOffsetMinutes);
  const currentMinute = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const delta = (currentMinute.getUTCMinutes() - schedule.offsetMinutes + 60) % schedule.intervalMinutes;
  currentMinute.setUTCMinutes(currentMinute.getUTCMinutes() - delta);
  return currentMinute;
}

export function granolaScheduledScanIsDue(
  now: Date,
  lastScheduledAt: DateValue | null,
  scanIntervalMinutes = GRANOLA_DEFAULT_SCAN_INTERVAL_MINUTES,
  scanOffsetMinutes = GRANOLA_DEFAULT_SCAN_OFFSET_MINUTES,
): boolean {
  const schedule = normalizedGranolaSchedule(scanIntervalMinutes, scanOffsetMinutes);
  const latestSlot = latestGranolaScanSlotAtOrBefore(now, schedule.intervalMinutes, schedule.offsetMinutes);
  if (lastScheduledAt) {
    return new Date(nextGranolaScanAt(new Date(lastScheduledAt), schedule.intervalMinutes, schedule.offsetMinutes)).getTime() <= now.getTime();
  }
  return now.getTime() - latestSlot.getTime() <= GRANOLA_SCHEDULER_INTERVAL_MINUTES * 60_000;
}

export async function granolaScheduledScanDue(now: Date = new Date()): Promise<boolean> {
  const sql = database();
  const rows = await sql`
    SELECT
      connections.scan_interval_minutes,
      connections.scan_offset_minutes,
      max(runs.started_at) AS last_scheduled_at
    FROM source_connections AS connections
    LEFT JOIN connection_sync_runs AS runs
      ON runs.connection_id = connections.id
      AND runs.trigger = 'scheduled'
    WHERE connections.id = ${GRANOLA_CONNECTION_ID}
    GROUP BY connections.scan_interval_minutes, connections.scan_offset_minutes
  ` as unknown as Array<{
    scan_interval_minutes: number | null;
    scan_offset_minutes: number | null;
    last_scheduled_at: DateValue | null;
  }>;
  const row = rows[0];
  return row
    ? granolaScheduledScanIsDue(
        now,
        row.last_scheduled_at,
        row.scan_interval_minutes ?? GRANOLA_DEFAULT_SCAN_INTERVAL_MINUTES,
        row.scan_offset_minutes ?? GRANOLA_DEFAULT_SCAN_OFFSET_MINUTES,
      )
    : false;
}

export function granolaScanStart(
  lastScheduledAt: DateValue | null,
  now: Date = new Date(),
): string {
  const fallbackMs = now.getTime() - 7 * 24 * 60 * 60 * 1_000;
  const previousMs = lastScheduledAt
    ? new Date(lastScheduledAt).getTime() - 5 * 60 * 1_000
    : fallbackMs;
  return new Date(Math.max(fallbackMs, previousMs)).toISOString();
}

export async function granolaScheduledUpdatedAfter(now: Date = new Date()): Promise<string> {
  const sql = database();
  const rows = await sql`
    SELECT max(finished_at) AS last_scheduled_at
    FROM connection_sync_runs
    WHERE connection_id = ${GRANOLA_CONNECTION_ID}
      AND trigger = 'scheduled'
      AND status = 'succeeded'
  ` as unknown as Array<{ last_scheduled_at: DateValue | null }>;
  return granolaScanStart(rows[0]?.last_scheduled_at ?? null, now);
}

export async function recordGranolaReviewRun(
  trigger: "manual" | "scheduled",
  status: "succeeded" | "failed",
  counts: Record<string, number>,
  errorMessage: string | null = null,
): Promise<void> {
  const sql = database();
  const runId = randomUUID();
  const serializedCounts = JSON.stringify(counts);

  await sql`
    INSERT INTO connection_sync_runs (
      id, connection_id, trigger, mode, status, counts, error_message, finished_at
    ) VALUES (
      ${runId}, ${GRANOLA_CONNECTION_ID}, ${trigger}, 'preview', ${status},
      ${serializedCounts}::jsonb, ${errorMessage}, now()
    )
  `;

  if (status === "succeeded") {
    await sql`
      UPDATE source_connections
      SET
        health = 'healthy',
        consecutive_failures = 0,
        last_success_at = now(),
        last_failure_message = NULL,
        updated_at = now()
      WHERE id = ${GRANOLA_CONNECTION_ID}
    `;
  } else {
    await sql`
      UPDATE source_connections
      SET
        consecutive_failures = consecutive_failures + 1,
        health = CASE WHEN consecutive_failures + 1 >= 3 THEN 'failed' ELSE 'degraded' END,
        last_failure_at = now(),
        last_failure_message = ${errorMessage},
        updated_at = now()
      WHERE id = ${GRANOLA_CONNECTION_ID}
    `;
  }
}

function nullableIso(value: DateValue | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function iso(value: DateValue): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function resolveGranolaReviewCandidate(
  candidate: GranolaActionCandidate,
  decisions: GranolaPriorReviewDecision[],
  linkedSources: GranolaLinkedTaskSource[],
  now: Date = new Date(),
): { status: "pending" | "accepted" | "dismissed"; resolvedAt: string | null } {
  const priorDecision = decisions.find(({ id }) => id === candidate.externalReference)
    ?? decisions.find(({ title, sourceExcerpt }) => (
      title === candidate.title && sourceExcerpt === candidate.sourceExcerpt
    ));
  if (priorDecision) {
    return { status: priorDecision.status, resolvedAt: priorDecision.resolvedAt };
  }

  const linkedTaskExists = linkedSources.some(({ externalReference, sourceUrl, title }) => (
    externalReference === candidate.externalReference
    || (sourceUrl === candidate.sourceUrl && title === candidate.title)
  ));
  if (linkedTaskExists) return { status: "accepted", resolvedAt: now.toISOString() };

  return { status: "pending", resolvedAt: null };
}

export async function saveGranolaReviewCandidates(
  noteId: string,
  candidates: GranolaActionCandidate[],
): Promise<number> {
  const sql = database();

  const decisionRows = await sql`
    SELECT id, title, source_excerpt, status, resolved_at
    FROM granola_review_candidates
    WHERE note_id = ${noteId} AND status IN ('accepted', 'dismissed')
  ` as unknown as Array<{
    id: string;
    title: string;
    source_excerpt: string;
    status: GranolaPriorReviewDecision["status"];
    resolved_at: DateValue | null;
  }>;
  const decisions = decisionRows.map((decision) => ({
    id: decision.id,
    title: decision.title,
    sourceExcerpt: decision.source_excerpt,
    status: decision.status,
    resolvedAt: nullableIso(decision.resolved_at),
  }));

  const candidateSourceUrl = candidates[0]?.sourceUrl;
  const linkedRows = candidateSourceUrl
    ? await sql`
        SELECT objects.external_reference, objects.title, objects.source_url
        FROM source_objects AS objects
        INNER JOIN automated_task_links AS links ON links.source_object_id = objects.id
        WHERE objects.connection_id = ${GRANOLA_CONNECTION_ID}
          AND links.rule_id = ${GRANOLA_RULE_ID}
          AND objects.source_url = ${candidateSourceUrl}
      ` as unknown as Array<{
        external_reference: string;
        title: string;
        source_url: string;
      }>
    : [];
  const linkedSources = linkedRows.map((source) => ({
    externalReference: source.external_reference,
    title: source.title,
    sourceUrl: source.source_url,
  }));

  await sql`
    UPDATE granola_review_candidates
    SET status = 'stale', resolved_at = now()
    WHERE note_id = ${noteId} AND status = 'pending'
  `;

  for (const candidate of candidates) {
    const resolution = resolveGranolaReviewCandidate(candidate, decisions, linkedSources);
    await sql`
      INSERT INTO granola_review_candidates (
        id, connection_id, note_id, external_reference, title, notes,
        source_url, source_excerpt, source_updated_at, status, resolved_at
      ) VALUES (
        ${candidate.externalReference}, ${GRANOLA_CONNECTION_ID}, ${noteId},
        ${candidate.externalReference}, ${candidate.title}, ${candidate.notes},
        ${candidate.sourceUrl}, ${candidate.sourceExcerpt}, ${candidate.sourceUpdatedAt},
        ${resolution.status}, ${resolution.resolvedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        notes = EXCLUDED.notes,
        source_url = EXCLUDED.source_url,
        source_excerpt = EXCLUDED.source_excerpt,
        source_updated_at = EXCLUDED.source_updated_at,
        status = CASE
          WHEN granola_review_candidates.status = 'stale' THEN EXCLUDED.status
          ELSE granola_review_candidates.status
        END,
        last_seen_at = now(),
        resolved_at = CASE
          WHEN granola_review_candidates.status = 'stale' THEN EXCLUDED.resolved_at
          ELSE granola_review_candidates.resolved_at
        END
    `;
  }

  const pending = await sql`
    SELECT count(*)::integer AS count
    FROM granola_review_candidates
    WHERE note_id = ${noteId} AND status = 'pending'
  ` as unknown as Array<{ count: number }>;
  return Number(pending[0]?.count ?? 0);
}

export async function queueGranolaActionsForReview(
  input: GranolaIngestInput,
): Promise<{ received: number; reviewCandidates: number }> {
  let reviewCandidates = 0;
  for (const action of input.actions) {
    reviewCandidates += await saveGranolaReviewCandidates(
      action.externalReference,
      [{ ...action, responsibility: "explicit" }],
    );
  }
  return { received: input.actions.length, reviewCandidates };
}

export async function loadGranolaDiagnostics(limit = 12): Promise<GranolaDiagnostics> {
  const boundedLimit = Math.max(1, Math.min(limit, 50));
  const sql = database();
  try {
    const [connections, events, reviewCandidates, pendingReviewCounts, syncRuns] = await Promise.all([
      sql`
        SELECT
          id, name, health, last_success_at, last_failure_at, last_failure_message,
          scan_interval_minutes, scan_offset_minutes
        FROM source_connections
        WHERE id = ${GRANOLA_CONNECTION_ID}
      `,
      sql`
        SELECT id, status, story_references[1] AS note_id, error_message, received_at, processed_at
        FROM source_webhook_events
        WHERE connection_id = ${GRANOLA_CONNECTION_ID}
        ORDER BY received_at DESC
        LIMIT ${boundedLimit}
      `,
      sql`
        SELECT id, title, source_url, source_excerpt, source_updated_at, status, last_seen_at
        FROM granola_review_candidates
        WHERE status = 'pending'
        ORDER BY last_seen_at DESC
        LIMIT ${boundedLimit}
      `,
      sql`
        SELECT COUNT(*)::int AS count
        FROM granola_review_candidates
        WHERE status = 'pending'
      `,
      sql`
        SELECT id, trigger, status, counts, error_message, started_at, finished_at
        FROM connection_sync_runs
        WHERE connection_id = ${GRANOLA_CONNECTION_ID}
        ORDER BY started_at DESC
        LIMIT ${boundedLimit}
      `,
    ]);

    const connection = connections[0] as {
      id: string;
      name: string;
      health: GranolaConnectionSnapshot["health"];
      last_success_at: DateValue | null;
      last_failure_at: DateValue | null;
      last_failure_message: string | null;
      scan_interval_minutes: number | null;
      scan_offset_minutes: number | null;
    } | undefined;
    if (!connection) throw new HttpError(503, "Granola Connection is not configured. Apply migration 0004.");

    return {
      connection: {
        id: connection.id,
        name: connection.name,
        health: connection.health,
        lastSuccessAt: nullableIso(connection.last_success_at),
        lastFailureAt: nullableIso(connection.last_failure_at),
        lastFailureMessage: connection.last_failure_message,
        nextScanAt: nextGranolaScanAt(
          new Date(),
          connection.scan_interval_minutes ?? GRANOLA_DEFAULT_SCAN_INTERVAL_MINUTES,
          connection.scan_offset_minutes ?? GRANOLA_DEFAULT_SCAN_OFFSET_MINUTES,
        ),
        scanIntervalSeconds: (connection.scan_interval_minutes ?? GRANOLA_DEFAULT_SCAN_INTERVAL_MINUTES) * 60,
        scanIntervalMinutes: connection.scan_interval_minutes ?? GRANOLA_DEFAULT_SCAN_INTERVAL_MINUTES,
        scanOffsetMinutes: connection.scan_offset_minutes ?? GRANOLA_DEFAULT_SCAN_OFFSET_MINUTES,
      },
      events: (events as Array<{
        id: string;
        status: GranolaWebhookEvent["status"];
        note_id: string | null;
        error_message: string | null;
        received_at: DateValue;
        processed_at: DateValue | null;
      }>).map((event) => ({
        id: event.id.replace(/^granola:/u, ""),
        status: event.status,
        noteId: event.note_id,
        detail: event.error_message,
        receivedAt: iso(event.received_at),
        processedAt: nullableIso(event.processed_at),
      })),
      pendingReviewCount: Number((pendingReviewCounts as Array<{ count: number | string }>)[0]?.count ?? 0),
      reviewCandidates: (reviewCandidates as Array<{
        id: string;
        title: string;
        source_url: string;
        source_excerpt: string;
        source_updated_at: DateValue | null;
        status: GranolaReviewCandidate["status"];
        last_seen_at: DateValue;
      }>).map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        sourceUrl: candidate.source_url,
        sourceExcerpt: candidate.source_excerpt,
        sourceUpdatedAt: nullableIso(candidate.source_updated_at),
        status: candidate.status,
        lastSeenAt: iso(candidate.last_seen_at),
      })),
      syncRuns: (syncRuns as Array<{
        id: string;
        trigger: GranolaSyncRun["trigger"];
        status: GranolaSyncRun["status"];
        counts: Record<string, number> | null;
        error_message: string | null;
        started_at: DateValue;
        finished_at: DateValue | null;
      }>).map((run) => ({
        id: run.id,
        trigger: run.trigger,
        status: run.status,
        counts: run.counts ?? {},
        errorMessage: run.error_message,
        startedAt: iso(run.started_at),
        finishedAt: nullableIso(run.finished_at),
      })),
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Error && /granola_review_candidates/u.test(error.message)) {
      throw new HttpError(503, "Granola reliability tables are unavailable. Apply migration 0009.");
    }
    if (error instanceof Error && /scan_interval_minutes|scan_offset_minutes/u.test(error.message)) {
      throw new HttpError(503, "Granola schedule settings are unavailable. Apply migration 0017.");
    }
    throw error;
  }
}

export async function updateGranolaScheduleSettings(
  scanIntervalMinutes: number,
  scanOffsetMinutes: number,
): Promise<void> {
  const schedule = normalizedGranolaSchedule(scanIntervalMinutes, scanOffsetMinutes);
  const sql = database();
  await sql`
    UPDATE source_connections
    SET
      scan_interval_minutes = ${schedule.intervalMinutes},
      scan_offset_minutes = ${schedule.offsetMinutes},
      updated_at = now()
    WHERE id = ${GRANOLA_CONNECTION_ID}
  `;
}

type ReviewCandidateRow = {
  id: string;
  external_reference: string;
  title: string;
  notes: string;
  source_url: string;
  source_excerpt: string;
  source_updated_at: DateValue | null;
  status: GranolaReviewCandidate["status"];
};

async function reviewCandidate(id: string): Promise<ReviewCandidateRow> {
  const sql = database();
  const rows = await sql`
    SELECT id, external_reference, title, notes, source_url, source_excerpt, source_updated_at, status
    FROM granola_review_candidates
    WHERE id = ${id}
  ` as unknown as ReviewCandidateRow[];
  const candidate = rows[0];
  if (!candidate) throw new HttpError(404, "Granola review candidate not found.");
  return candidate;
}

export async function acceptGranolaReviewCandidate(id: string): Promise<void> {
  const candidate = await reviewCandidate(id);
  if (candidate.status !== "pending") throw new HttpError(409, "This Granola candidate was already reviewed.");

  await ingestGranolaActions({
    actions: [{
      externalReference: candidate.external_reference,
      title: candidate.title,
      notes: candidate.notes,
      sourceUrl: candidate.source_url,
      sourceExcerpt: candidate.source_excerpt,
      dueAt: null,
      sourceUpdatedAt: nullableIso(candidate.source_updated_at),
    }],
  }, { trigger: "manual", counts: { reviewed: 1 } });

  const sql = database();
  await sql`
    UPDATE granola_review_candidates
    SET status = 'accepted', resolved_at = now()
    WHERE id = ${id} AND status = 'pending'
  `;
}

export async function dismissGranolaReviewCandidate(id: string): Promise<void> {
  const sql = database();
  const rows = await sql`
    UPDATE granola_review_candidates
    SET status = 'dismissed', resolved_at = now()
    WHERE id = ${id} AND status = 'pending'
    RETURNING id
  `;
  if (rows.length === 0) throw new HttpError(404, "Pending Granola review candidate not found.");
}

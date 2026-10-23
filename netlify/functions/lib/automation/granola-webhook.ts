import { deferWorkEvent } from "../work-inbox.js";
import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { database } from "../database.js";
import { HttpError } from "../http.js";
import { extractGranolaActionCandidates } from "./granola-actions.js";
import { getGranolaNote } from "./granola-client.js";
import { GRANOLA_CONNECTION_ID } from "./granola-ingest.js";
import { saveGranolaReviewCandidates } from "./granola-repository.js";

export const granolaWebhookEventSchema = z.object({
  event_id: z.string().min(1).max(500),
  event_type: z.enum(["note.generated", "note.edited", "note.access_granted"]),
  note_id: z.string().min(1).max(500),
  occurred_at: z.string().min(1),
}).passthrough();

type GranolaWebhookDependencies = {
  defer: typeof deferWorkEvent;
  claim: (eventId: string, noteId: string) => Promise<boolean>;
  finish: (eventId: string, status: "succeeded" | "ignored" | "failed", errorMessage?: string | null) => Promise<void>;
  getNote: typeof getGranolaNote;
  saveReviewCandidates: typeof saveGranolaReviewCandidates;
};

function storedEventId(eventId: string): string {
  return `granola:${eventId}`;
}

async function claimGranolaWebhookEvent(eventId: string, noteId: string): Promise<boolean> {
  const sql = database();
  const rows = await sql`
    INSERT INTO source_webhook_events (id, connection_id, status, story_references)
    VALUES (${storedEventId(eventId)}, ${GRANOLA_CONNECTION_ID}, 'processing', ARRAY[${noteId}]::text[])
    ON CONFLICT (id) DO UPDATE SET
      status = 'processing',
      error_message = NULL,
      processed_at = NULL,
      received_at = now()
    WHERE source_webhook_events.status IN ('failed', 'ignored')
       OR (source_webhook_events.status = 'processing' AND source_webhook_events.received_at < now() - interval '10 minutes')
    RETURNING id
  `;
  return rows.length > 0;
}

async function finishGranolaWebhookEvent(
  eventId: string,
  status: "succeeded" | "ignored" | "failed",
  errorMessage: string | null = null,
): Promise<void> {
  const sql = database();
  await sql`
    UPDATE source_webhook_events
    SET status = ${status}, error_message = ${errorMessage}, processed_at = now()
    WHERE id = ${storedEventId(eventId)}
  `;
  if (status === "failed") {
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
  } else {
    await sql`
      UPDATE source_connections
      SET
        consecutive_failures = 0,
        health = 'healthy',
        last_success_at = now(),
        last_failure_message = NULL,
        updated_at = now()
      WHERE id = ${GRANOLA_CONNECTION_ID}
    `;
  }
}

const defaultDependencies: GranolaWebhookDependencies = {
  claim: claimGranolaWebhookEvent,
  defer: deferWorkEvent,
  finish: finishGranolaWebhookEvent,
  getNote: getGranolaNote,
  saveReviewCandidates: saveGranolaReviewCandidates,
};

export function verifyGranolaWebhookSignature(
  body: string,
  webhookId: string,
  webhookTimestamp: string,
  webhookSignature: string,
  secret: string,
  now = Date.now(),
): boolean {
  const timestamp = Number(webhookTimestamp);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp * 1_000) > 5 * 60 * 1_000) return false;

  const encodedSecret = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const key = Buffer.from(encodedSecret, "base64");
  if (key.length === 0) return false;
  const expected = createHmac("sha256", key)
    .update(`${webhookId}.${webhookTimestamp}.${body}`, "utf8")
    .digest("base64");

  return webhookSignature.split(/\s+/u).some((candidate) => {
    const [version, supplied] = candidate.split(",", 2);
    if (version !== "v1" || !supplied) return false;
    const suppliedBytes = Buffer.from(supplied, "utf8");
    const expectedBytes = Buffer.from(expected, "utf8");
    return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
  });
}

export async function processGranolaWebhook(
  body: string,
  headers: { id: string; timestamp: string; signature: string },
  secrets: { webhook: string; apiKey: string },
  dependencies: Partial<GranolaWebhookDependencies> = {},
): Promise<boolean> {
  if (!verifyGranolaWebhookSignature(body, headers.id, headers.timestamp, headers.signature, secrets.webhook)) {
    throw new HttpError(401, "Invalid Granola webhook signature.");
  }

  let input: unknown;
  try {
    input = JSON.parse(body);
  } catch {
    throw new HttpError(400, "Granola webhook body must be valid JSON.");
  }
  const event = granolaWebhookEventSchema.parse(input);
  if (event.event_id !== headers.id) throw new HttpError(400, "Granola webhook ID does not match its signed header.");

  return processVerifiedGranolaWebhook(event, secrets.apiKey, dependencies);
}

// Internal replay only: the public endpoint validates signatures before persistence.
export async function processVerifiedGranolaWebhook(event: z.infer<typeof granolaWebhookEventSchema>, apiKey: string, dependencies: Partial<GranolaWebhookDependencies> = {}): Promise<boolean> {
  const deps = { ...defaultDependencies, ...dependencies };
  if (await deps.defer("granola", event.event_id, JSON.stringify(event))) return false;
  if (!await deps.claim(event.event_id, event.note_id)) return false;

  try {
    const note = await deps.getNote(event.note_id, apiKey);
    const candidates = extractGranolaActionCandidates(note);
    const reviewCount = await deps.saveReviewCandidates(note.id, candidates);
    if (candidates.length === 0) {
      await deps.finish(event.event_id, "ignored", "No explicit Kyle action was found.");
      return true;
    }
    await deps.finish(
      event.event_id,
      "succeeded",
      reviewCount > 0
        ? `${reviewCount} personal next ${reviewCount === 1 ? "step needs" : "steps need"} review.`
        : "Personal next steps were already reviewed.",
    );
    return true;
  } catch (error) {
    await deps.finish(
      event.event_id,
      "failed",
      error instanceof Error ? error.message : "Unexpected Granola webhook failure.",
    );
    throw error;
  }
}

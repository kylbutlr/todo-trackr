import { granolaIngestSchema } from "./automation/granola-ingest.js";
import { queueGranolaActionsForReview } from "./automation/granola-repository.js";
import { ingestCodexSession, ingestCodexSessionSchema } from "./automation/codex-repository.js";
import { database } from "./database.js";
import { workInbox, type DeferredEvent } from "./work-inbox.js";
import { automaticWorkAllowed } from "./work-switch.js";
import { processVerifiedShortcutWebhook, shortcutWebhookEventSchema } from "./automation/shortcut-webhook.js";
import { processVerifiedGranolaWebhook, granolaWebhookEventSchema } from "./automation/granola-webhook.js";
import { requireEnvironment } from "./config.js";

export async function drainWorkInbox(): Promise<boolean> {
  if (!process.env.APP_SWITCHR_URL || !await automaticWorkAllowed()) return false;
  const store = workInbox();
  let processed = 0;
  const keys: string[] = [];
  for await (const page of store.list({ paginate: true })) keys.push(...page.blobs.map(blob => blob.key));
  for (const key of keys.sort()) {
    if (++processed > 100 || !await automaticWorkAllowed()) return false;
    const entry = await store.get(key, { type: "json" }) as DeferredEvent | null;
    if (!entry) continue;
    // Replayed events retain the original event ID. Database claims provide deduplication.
    if (entry.provider === "granola-actions") {
      await queueGranolaActionsForReview(granolaIngestSchema.parse(JSON.parse(entry.body)));
      await store.delete(key); continue;
    }
    if (entry.provider === "codex") {
      await ingestCodexSession(ingestCodexSessionSchema.parse(JSON.parse(entry.body)));
      await store.delete(key); continue;
    }
    const done = entry.provider === "shortcut"
      ? await processVerifiedShortcutWebhook(shortcutWebhookEventSchema.parse(JSON.parse(entry.body)), { defer: async () => false })
      : await processVerifiedGranolaWebhook(granolaWebhookEventSchema.parse(JSON.parse(entry.body)), requireEnvironment("GRANOLA_API_KEY"), { defer: async () => false });
    // A conflicting/in-progress claim stays in the inbox, never silently discarded.
    if (done) await store.delete(key);
    else {
      // A previous worker may have completed processing but lost its delete response.
      const payload = JSON.parse(entry.body) as { id?: string; event_id?: string };
      const eventId = entry.provider === "shortcut" ? payload.id : `granola:${payload.event_id}`;
      const rows = await database()`SELECT status FROM source_webhook_events WHERE id = ${eventId}`;
      if (rows[0]?.status === "succeeded" || rows[0]?.status === "ignored") await store.delete(key);
      else return false;
    }
  }
  return true;
}

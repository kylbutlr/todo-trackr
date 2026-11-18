# Granola next-step ingestion

Todo Trackr can receive Granola's signed `note.generated`, `note.edited`, and `note.access_granted` webhooks directly. For each event, it fetches the note from Granola's public API and holds explicit `Kyle` or `Me` bullets inside an Action Items, Next Steps, Follow-up, or Tasks section for review.

Examples that are intentionally accepted:

```markdown
## Action Items
- Kyle: Send the staging preview
- Me to confirm the launch date
- **Finish the CMS cleanup, then review with Michael** (Kyle)
- **Publish the revised notes** (Kyle / Matt)
```

Assignments to other people, unassigned team actions, and Kyle mentions outside an action section are ignored. A personal next step becomes a Task only after Kyle selects `Add Task` in the Granola Connection review queue. The generated Task retains the Granola note link and source excerpt. Its lifecycle becomes user-controlled after capture because the meeting note does not provide a deterministic Completion Signal.

The Granola Connection also runs a scheduled repair every six hours. It shares its cron window with Shortcut repair so Neon can return to Idle between unattended jobs. Each successful scan becomes the next scan's checkpoint, with a five-minute overlap to cover delayed scheduling. The first scheduled scan and the manual repair action use a seven-day recovery window. Both paths refresh the review queue without creating Tasks automatically. Set `TODO_TRACKER_GRANOLA_REPAIR_ENABLED=false` to disable only the scheduled repair while leaving signed webhooks active.

## Direct webhook setup

1. Add `GRANOLA_API_KEY` to the Netlify Production environment as a secret.
2. Deploy the `/api/webhooks/granola` function.
3. Register `https://todotrackr.netlify.app/api/webhooks/granola` with Granola using the `personal` scope and the `note.generated`, `note.edited`, and `note.access_granted` events.
4. Copy the one-time `signing_secret` returned by Granola into Netlify as secret `GRANOLA_WEBHOOK_SECRET`, then redeploy.

Example registration request, run locally with the key in your shell environment:

```bash
curl --request POST https://public-api.granola.ai/v1/webhook-endpoints \
  --header "Authorization: Bearer $GRANOLA_API_KEY" \
  --header "Content-Type: application/json" \
  --data '{"url":"https://todotrackr.netlify.app/api/webhooks/granola","scopes":["personal"],"events":["note.generated","note.edited","note.access_granted"]}'
```

Do not paste the API key or returned signing secret into source code or chat. Granola returns the signing secret only when the webhook is created.

## Trusted ingestion fallback

Todo Trackr retains a narrow server-to-server endpoint for trusted Granola automations that have already resolved personal responsibility:

```text
POST /api/ingest/granola/actions
Authorization: Bearer $TODO_TRACKR_INGEST_TOKEN
Content-Type: application/json
```

The caller supplies already-resolved next steps for Kyle. Those actions enter the same Granola Connection review queue and do not create Tasks until approved. Todo Trackr does not infer responsibility from a full meeting transcript.

```json
{
  "actions": [
    {
      "externalReference": "meeting-id/action-id",
      "title": "Send the staging preview to the client",
      "sourceUrl": "https://app.granola.ai/notes/meeting-id",
      "sourceExcerpt": "Kyle will send the staging preview after QA.",
      "notes": "",
      "dueAt": null,
      "sourceUpdatedAt": "2026-08-16T18:30:00Z"
    }
  ]
}
```

`externalReference` is the idempotency key. Re-sending the same action refreshes its review candidate without creating a duplicate Task. Approved Tasks are open, belong to Inbox, appear in All and Sources > Granola, and retain their Granola note link. Their lifecycle becomes user-controlled after capture because a meeting note does not provide a deterministic completion signal.

## Fallback setup

1. Apply `database/migrations/0004_granola_ingest.sql` and `database/migrations/0009_granola_reliability.sql` in Neon.
2. Generate `TODO_TRACKR_INGEST_TOKEN` with `openssl rand -base64 48` and add it to the Netlify Production Functions environment.
3. Configure a trusted automation to read newly completed meetings, identify explicit next steps assigned to Kyle or "Me", and POST those normalized actions to this endpoint.
4. Keep the automation's last successful meeting boundary and stable action identifiers so retries remain deterministic.

The ingestion token grants Task-creation access and must not be stored in the browser extension, web client, macOS app, source code, or meeting notes.

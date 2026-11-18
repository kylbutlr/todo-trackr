# Setup

## Hosted environment

Configure these Netlify environment variables for the `Production` deploy context. If scope selection is available, select `Functions`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled Neon PostgreSQL connection string |
| `TODO_TRACKER_PASSWORD_HASH` | Scrypt-derived password verifier |
| `SESSION_SIGNING_SECRET` | Random secret used to sign sessions |
| `SHORTCUT_API_TOKEN` | Shortcut REST API token used only by Todo Trackr's read-only source client |
| `SHORTCUT_WEBHOOK_SECRET` | Authenticates internal scheduled Shortcut sync handoffs and optional Shortcut webhooks |
| `TODO_TRACKER_SHORTCUT_REPAIR_ENABLED` | Optional scheduled Shortcut repair switch; set to `false` to keep webhooks active without scheduled repair |
| `TODO_TRACKR_INGEST_TOKEN` | Random bearer token for trusted action-ingestion automations such as Granola |
| `GRANOLA_API_KEY` | Granola public API key used only by server-side Functions |
| `GRANOLA_WEBHOOK_SECRET` | Verifies signed Granola webhook deliveries and authenticates internal scheduled review scans |
| `TODO_TRACKER_GRANOLA_REPAIR_ENABLED` | Optional scheduled Granola repair switch; set to `false` to keep webhooks active without scheduled repair |
| `TRIGGER_SECRET_KEY` | Trigger.dev Production secret key used only by Netlify to schedule and cancel delayed alarm runs |
| `VAPID_PUBLIC_KEY` | Public Web Push application-server key |
| `VAPID_PRIVATE_KEY` | Private Web Push application-server key |
| `VAPID_SUBJECT` | Web Push contact URI, such as `mailto:you@example.com` |

Mark every value except `VAPID_PUBLIC_KEY` as secret when Netlify offers that option.

The production Neon connection must not be assigned to Deploy Previews. A later development branch should supply preview and local connection strings.

## Password setup

After installing dependencies, run:

```bash
npm run auth:hash
```

Enter the private Todo Trackr password at the hidden prompt. Copy the generated verifier directly into Netlify as `TODO_TRACKER_PASSWORD_HASH`. The verifier is not the plaintext password, but it should still be treated as a secret.

Generate the signing secret with:

```bash
openssl rand -base64 48
```

Copy the output directly into Netlify as `SESSION_SIGNING_SECRET`.

## Database migration

Run migrations using a direct, non-pooled Neon connection. Runtime API traffic uses the pooled `DATABASE_URL`. The direct migration connection should not be stored in a browser-visible environment variable.

Apply migrations through the Neon SQL Editor or a trusted PostgreSQL migration tool, in filename order. Existing installations should apply every migration through `database/migrations/0017_granola_schedule_settings.sql` before deploying this build.

Migration `0003` adds Source metadata, the Archived lifecycle, the full Priority scale, and the tables used by Connections, Automation Rules, reconciliation, and Automation Activity. It seeds the Shortcut Connection in an Off state. The separately confirmed initial import is available after selecting Review and remains approval-gated.

Migration `0005` adds per-Connection Review and Automatic synchronization modes plus idempotent webhook event records. Existing Shortcut Connections begin in Review mode while retaining their current Off state until changed in the app.

Migration `0006` allows historical private incremental polling runs to remain visible in Connection Sync History. New deployments use webhooks and scheduled repair instead of the incremental scheduler.

Migration `0007` stores per-device Web Push subscriptions. Generate one VAPID key pair locally with `npm run push:keys`, then copy its public and private values into the matching Netlify Production variables. Set `VAPID_SUBJECT` to a monitored `mailto:` URI. Never commit or paste the private key into application code.

Migration `0008` registers proposed Shortcut Responsibility Rule v2 and stores its non-mutating shadow observations. Shortcut source observations can evaluate recently changed Stories against v2 after the active v1 reconciliation succeeds. The Shortcut Connection page can also refresh a candidate sweep on request. Neither path applies v2 decisions to Tasks.

Migration `0009` adds the durable Granola review queue. The Granola Connection page shows webhook diagnostics, recent capture runs, explicit personal next steps awaiting approval, a six-hour scheduled repair, and a manual seven-day repair scan. Unassigned team actions are ignored, and every discovered Granola Task requires approval before creation.

Migration `0010` adds Todo Trackr-owned Starred state. Starred is personal attention metadata, so it can be changed for Shortcut-managed Tasks without writing anything back to Shortcut.

Migration `0011` adds Todo Trackr-owned Starred preferences for the live Shortcut Board. The board stays read-only toward Shortcut, supports Owner, Requester, Owner and requester, and Owner or requester scopes, and appears in the web workspace, native macOS workspace, and Mini Trackr.

Migration `0012` adds task-attached Codex Work Sessions and a Codex Connection health record. A Work Session preserves the Task's original Source and stores only observability metadata, not the Codex transcript. See [Codex Work Sessions](./codex-work-sessions.md) for the trusted update contract.

Migration `0013` adds the schema migration ledger, recoverable Task deletion, and recovery-run audit records. The System health Connection shows the current and required schema versions, deployment metadata, Connection health, scheduler activity, and environment-variable presence without returning secret values.

Migration `0015` adds persistent Attention Alarms. A Task may have a date and time independent of its Due Date and Priority. When the alarm time arrives, Todo Trackr keeps the Task in the Needs Attention state until the alarm is explicitly cleared. Completing, archiving, or deleting the Task also suppresses future alarm delivery. The native macOS app schedules an exact local notification when permission is available. Server Web Push delivery uses the delayed background task configured by migration `0016`.

Migration `0016` stores the Trigger.dev run associated with each active alarm. Setting or rescheduling an alarm creates one delayed run instead of polling Neon. Clearing, completing, archiving, or deleting the Task cancels that run. Trigger.dev must define `TODO_TRACKR_TRIGGER_CALLBACK_URL` as `https://todotrackr.netlify.app/api/ingest/task-alarms` and `TODO_TRACKR_INGEST_TOKEN` as the same secret already configured in Netlify. Deploy the Trigger.dev tasks before enabling production alarm scheduling.

Migration `0017` added Granola scan frequency and minute offset settings. Those columns remain for backward-compatible data reads, but the cost-controlled scheduler now uses a fixed six-hour repair window and the web client no longer exposes the obsolete high-frequency controls.

The System health screen can download a versioned JSON backup and import it in `only_missing` mode. Imports never overwrite existing data and skip Shortcut-managed Tasks. Deleted user-managed Tasks remain recoverable from the same screen. Keep exported JSON private because it contains Task titles, notes, and source links.

To enable Automatic Shortcut synchronization after deploying migration `0006`:

1. Generate a private random value for `SHORTCUT_WEBHOOK_SECRET` and add it to the Production Netlify environment.
2. Configure the Shortcut outgoing webhook to send signed events to `https://todotrackr.netlify.app/api/webhooks/shortcut` using the same secret.
3. Open Shortcut under Connections in Todo Trackr and select Automatic. Todo Trackr immediately reconciles current state before accepting ongoing webhook updates.

Automatic mode reconciles changed Shortcut Stories from authenticated webhook events. The `shortcut-scheduled` Netlify Function runs a full repair every six hours as a safety net. Review mode retains the manual Preview and Apply changes flow. Off mode ignores webhook processing and performs no scheduled source mutation.

Shortcut and Granola repairs share the same six-hour cron window so they can reuse one Neon wake period. If either adapter is not needed, set its repair switch to `false`. See [Neon compute budget](./neon-compute-budget.md) for the verification procedure and emergency controls.

Connection settings expose the estimated next repair, the latest webhook and full reconciliation times, 90 days of Sync History, and recent Automation Activity. After the Web Push variables and migration are deployed, turn on Automation notifications from Shortcut Connection settings on each browser or installed Home Screen device that should receive them. Lifecycle changes are grouped per reconciliation, routine metadata updates stay silent, the third consecutive transient failure notifies once, and authentication or configuration failures notify immediately.

Migration `0004` adds Granola as a Source and seeds its idempotent next-step ingestion rule. The preferred direct integration uses `GRANOLA_API_KEY` and signed events at `https://todotrackr.netlify.app/api/webhooks/granola`. Register that URL after deployment, then save Granola's one-time returned signing secret as `GRANOLA_WEBHOOK_SECRET` and redeploy. See [Granola integration](./granola-integration.md) for the registration request and the narrower trusted-ingestion fallback.

## Local web development

Todo Trackr targets Node.js 24, matching Netlify's current default build runtime. If you use `nvm`, run `nvm use` from the repository root.

Create an ignored `.env` using credentials for a non-production Neon branch:

```bash
cp .env.example .env
```

Then run:

```bash
npm install
npx netlify dev
```

## macOS development

Open `apps/macos/Package.swift` in Xcode and run the `TodoTracker` scheme against `My Mac`.

Fresh clients default to `http://127.0.0.1:8888` and let you enter another server in the connection screen. Only an existing legacy credential selects the original hosted endpoint. `TODO_TRACKER_API_BASE_URL` remains an optional development override.

## Install the macOS app

Before the first local install, create a persistent signing identity in Keychain Access:

1. Choose **Keychain Access → Certificate Assistant → Create a Certificate…**.
2. Name it `Todo Trackr Local Code Signing`.
3. Select **Self Signed Root** and **Code Signing**.
4. Enable **Let me override defaults**, use a long validity such as 3650 days, accept the remaining defaults, and save it to the login keychain.

Confirm that the identity is available:

```bash
security find-identity -v -p codesigning
```

Build a release app bundle, sign it with that persistent identity, install it to `~/Applications`, and open it with:

```bash
npm run install:macos
```

The installed app has a normal macOS bundle identifier, app icon, version metadata, and bundled Geist fonts. It can be launched from Spotlight, Finder, or kept in the Dock without opening Xcode.

The build defaults to `Todo Trackr Local Code Signing`. Override it with `TODO_TRACKR_CODESIGN_IDENTITY` when another persistent Code Signing identity should be used. The build refuses ad hoc signing because an identity-changing update causes macOS to discard Accessibility approval. Developer ID signing and notarization are only needed if the app will be distributed to other Macs.

After replacing an older ad hoc-signed installation with the first persistently signed build, remove the old Todo Trackr entry from **Privacy & Security → Accessibility**, add the new app, and approve it once. Later builds signed by the same identity retain the same designated requirement.

### macOS distribution

The public v1.0.0 release distributes Mac source only. [release.json](../release.json) records this decision. No paid Apple Developer membership, notarization, binary archive, or public appcast is needed for the GitHub source/server/extension release. Local source builds disable Sparkle automatic updates and use manual rebuilds.

The legacy private update archives remain preserved for existing installations. Do not regenerate or publish them as v1.0.0 assets. A future notarized binary release must deliberately select that distribution mode and complete Developer ID signing, notarization, source-provenance, and signed-feed verification. See [Sparkle documentation](https://sparkle-project.org/documentation/) and [Apple distribution guidance](https://developer.apple.com/developer-id/).

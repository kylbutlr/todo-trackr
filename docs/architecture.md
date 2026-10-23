# Architecture

## Boundary

The web and macOS clients never receive PostgreSQL credentials. All clients call the installation API. The standalone Node.js process serves the web app and API, uses a PostgreSQL pool, and runs a database-backed alarm scanner. The legacy Netlify adapter uses the same handler with Neon and Trigger.dev. Installation capabilities control optional features.

```text
React web client       -> Netlify Functions API -> Neon PostgreSQL
SwiftUI client         -> Netlify Functions API -> Neon PostgreSQL
Browser Quick Capture  -> Netlify Functions API -> Neon PostgreSQL
Trigger.dev alarm run  -> authenticated Netlify callback -> Neon + Web Push
```

## Authentication

Todo Trackr runs one owner per installation. Password mode is the default. Explicit standalone passwordless mode bypasses interactive session requirements while retaining independent service-ingestion credentials.

- A password is verified against `TODO_TRACKER_PASSWORD_HASH` inside a Netlify Function.
- Browser sessions use a signed, secure, HTTP-only cookie.
- The macOS client stores its signed bearer token in Keychain.
- The browser extension stores a scoped signed bearer token in extension-local storage.
- Rotating `SESSION_SIGNING_SECRET` invalidates every existing session.
- Login attempts are rate-limited by a one-way fingerprint of the requesting address.

No plaintext password is stored in the repository, browser storage, database, or macOS preferences.

## API

In password mode, all task routes require a valid session. Standalone passwordless mode deliberately grants owner access to every caller who can reach the server. Host and browser-origin checks still apply.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Start a web or macOS session |
| `POST` | `/api/auth/logout` | End a browser session |
| `GET` | `/api/auth/session` | Check the current session |
| `GET` | `/api/tasks` | List tasks; pass `status=open` for a lightweight active-task snapshot |
| `POST` | `/api/tasks` | Create a task |
| `PATCH` | `/api/tasks/:id` | Update a task |
| `DELETE` | `/api/tasks/:id` | Delete a task |
| `GET` | `/api/lists` | List user-created lists and Inbox |
| `POST` | `/api/lists` | Create a list |
| `GET` | `/api/review-summary` | Return the combined Granola and Review-mode Shortcut count for Mini Trackr |
| `POST` | `/api/ingest/task-alarms/:id` | Validate a delayed alarm callback, atomically claim it, and send Web Push |
| `POST` | `/api/connections/shortcut/preview` | Preview the read-only Shortcut Automation Rule without changing Tasks |
| `POST` | `/api/connections/shortcut/import` | Apply one approval-token-guarded, create-only initial Shortcut import while the Connection remains paused |
| `GET` | `/api/connections/shortcut` | Read Shortcut mode and health without fetching Shortcut |
| `PATCH` | `/api/connections/shortcut` | Change Shortcut between Off, Review, and Automatic |
| `POST` | `/api/connections/shortcut/sync` | Run the Automatic reconciliation immediately |
| `POST` | `/api/webhooks/shortcut` | Receive authenticated Shortcut events in a background function |
| `POST` | `/api/ingest/granola/actions` | Idempotently queue authenticated Granola next steps for manual review |
| `POST` | `/api/webhooks/granola` | Verify a signed Granola note event, fetch its note, and queue explicit Kyle next steps for review |
| `GET` | `/api/connections/shortcut/rule-v2-shadow` | Read the latest non-mutating Shortcut Responsibility Rule v2 observations |
| `POST` | `/api/connections/shortcut/rule-v2-shadow` | Refresh the v2 candidate sweep without changing Tasks |

## Task contract

```json
{
  "id": "uuid",
  "title": "string",
  "notes": "string",
  "status": "open | completed | archived",
  "priority": "none | lowest | low | medium | high | highest",
  "dueAt": "ISO-8601 timestamp or null",
  "sortOrder": 0,
  "createdAt": "ISO-8601 timestamp",
  "updatedAt": "ISO-8601 timestamp",
  "completedAt": "ISO-8601 timestamp or null",
  "archivedAt": "ISO-8601 timestamp or null",
  "listId": "uuid",
  "source": "manual | browser | shortcut | granola | slack | gmail",
  "sourceUrl": "URL or null",
  "sourceDetails": "read-only Source metadata or null"
}
```

Every task belongs to one List. Inbox is the default List. All, Today, Upcoming, Overdue, Completed, and Archived are derived Smart Views and do not duplicate task records. All contains only open, non-archived Tasks across every List and Source.

## Browser Quick Capture

The browser extension is intentionally a companion instead of a second full workspace. Its command receives temporary access to the active tab, captures selected text with the page title as fallback, and creates one Task in Inbox with the page URL. Captures from Slack's web app are attributed to Slack and retain the selected message permalink when the current Slack markup exposes it, with the conversation URL as a fallback. It does not continuously inspect tabs or browsing history. The hosted web and native clients remain the full task-management surfaces.

## macOS menu-bar Quick Capture

The installed macOS app runs as a menu-bar utility instead of a Dock application. Its global `Command+Shift+E` hotkey reads the focused application's selected text through macOS Accessibility, opens a compact editable capture window, and creates a manual Inbox Task after confirmation. The first attempt requests Accessibility permission; if selected text is unavailable, the capture window remains available for typing. The menu bar also exposes the full workspace, sync status, update checks, sign out, and quit.

## Shortcut activation boundary

The authenticated preview fetches assigned stories only from actionable workflow states, then separately observes existing imported references so unassignment and lifecycle changes remain detectable. It normalizes source-owned metadata, evaluates a versioned pure Automation Rule, and creates brief Source excerpts by cleaning the first meaningful content from each Shortcut description.

The initial import is a separate create-only operation in Review mode. It recomputes the preview, requires an exact approval token, and writes its Tasks, Source Objects, Automation Activity, and successful Sync History in one transaction. Shortcut-backed Tasks expose List and Notes as user-controlled fields; the API rejects Todo Trackr attempts to change their title, lifecycle, priority, due date, or deletion. Todo Trackr never writes to Shortcut.

Shortcut has three user-controlled modes. Off ignores source processing and preserves existing Tasks. Review requires an approval token before applying a proposed batch. Mini Trackr's combined review indicator refreshes the non-mutating Review preview every 15 minutes while that mode is active. Automatic runs one full reconciliation when enabled, applies authenticated Shortcut webhook events as they arrive, and starts a full background repair every six hours. Webhook event IDs make delivery idempotent, while the repair is the correctness backstop for missed events.

Granola discovery is automatic while Task creation remains manual. Signed webhooks queue explicit personal next steps promptly. A private six-hour repair resumes from the last successful scheduled scan with a five-minute overlap and uses a seven-day recovery window on first run. Both discovery paths update the durable review queue, and only `Add Task` creates a Task.

## Synchronization

Clients refresh after every mutation and whenever their task surface becomes active. Visible web and macOS Task surfaces begin with 30-second task reads, then back off to one, two, and ten minutes when snapshots stay unchanged. Web connection diagnostics load on their own visible connection views instead of riding every task poll. The macOS app refreshes a complete task-and-list snapshot periodically during active work and on each idle wake; it performs no Task API refresh while both task surfaces are hidden. Mini Trackr refreshes its combined Granola and Shortcut review count every 15 minutes while visible and immediately when reopened. Selecting that count opens the applicable web review connection in Chrome, falling back to the default browser when Chrome is unavailable, and temporarily checks every 5 seconds for up to 2 minutes so completed review work clears promptly. Opening either native surface triggers an immediate open-task refresh.

Task-list responses include a private ETag and accept conditional requests. An unchanged snapshot returns HTTP 304 without retransmitting task JSON. Native frequent refreshes request only `status=open` and merge that snapshot with already-loaded Completed and Archived history. This keeps active work current without repeatedly downloading historical tasks.

Web edits send the Task's observed `updated_at` as an optimistic concurrency guard. If another client changed the Task first, the API returns the current Task with HTTP 409, the editor preserves the unsaved draft, and a second explicit save may apply it against the new version. Older native clients remain backward compatible until the same guard ships in a signed macOS release. Offline mutation queues and live updates are deferred until actual usage demonstrates the need.

## macOS update channel

The native app embeds Sparkle and checks a public appcast hosted with the Netlify web build. Each update archive and the appcast itself are created locally, signed with the private EdDSA key stored in the owner's macOS Keychain, and committed under `apps/web/public/updates`. A versioned source-provenance JSON manifest records the SHA-256 digest of the native source tree, and CI recomputes it before merge. The app verifies the feed and archive before extraction and contains only the matching public verification key. Update archives contain no database credentials or application passwords.

Task updates use an exact server-provided optimistic-lock token on both web and native clients. Native keeps that token separate from Swift `Date` decoding so PostgreSQL microseconds survive a round trip. When an editable-field conflict occurs, the latest server snapshot replaces the stale model while the editor draft remains intact for review.

User-managed Task deletion is recoverable after migration `0013`. Normal Task queries exclude soft-deleted records, while the authenticated recovery module can list and restore them. JSON imports use an `only_missing` policy and do not overwrite live records or recreate Shortcut-managed Tasks.

## Visual system

Both clients follow the release pinned in `app-stylr.json`. Shared App Stylr decisions are vendored in `design/tokens.json`, `design/app-stylr.css`, and `apps/macos/Sources/Design/AppStylrTokens.swift`, including Geist typography, the Ink-to-Mint palette, semantic colors, spacing, radii, and motion. Platform-native behavior may differ, but visible hierarchy, terminology, and state treatment should remain aligned. Intentional differences are recorded in `docs/app-stylr-exceptions.md`.

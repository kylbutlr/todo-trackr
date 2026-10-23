# Self-hosting

Todo Trackr runs one owner's workspace per installation. The standalone runtime serves the web app and API, connects to PostgreSQL, and scans persistent task alarms every 15 seconds. The Mac app and extension connect to that same server.

This implementation is under release validation. The embedded-database tests cover migrations, task editing, conflicts, recovery, alarms, and protected/passwordless sessions. The Docker/PostgreSQL rehearsal also covers both password modes, real concurrent-edit conflicts, restart recovery, and database dump/restore. A real installed-extension review remains outstanding. Mac distribution is source only, without a paid Apple membership or a binary update feed.

## Requirements

For the container path, use Docker with Compose. Protected-mode setup also uses Node.js 24 to generate the password verifier; the server itself runs inside the container. For a source installation, use Node.js 24 and a PostgreSQL database you control. The maintainer's Netlify site and Neon database are not needed for the standalone core. Trigger.dev is not needed for standalone alarm scheduling.

The current standalone release scope is task management and capture. Shortcut, Granola, Codex, and App Switchr are legacy hosted-adapter features and are disabled in the standalone configuration. App Switchr is always bypassed in standalone mode, including when old Switchr environment settings are inherited. The other adapters are outside the public v1 feature set until their personal mappings are generalized and verified.

## Configure the installation

From your checkout:

```bash
cp .env.self-hosted.example .env.self-hosted
```

The completed file is ignored by Git. Set a unique hexadecimal `POSTGRES_PASSWORD`; hexadecimal avoids URL-encoding ambiguity in Compose's database connection string. Generate it locally:

```bash
openssl rand -hex 32
```

### With a password

Keep `TODO_TRACKER_AUTH_MODE=password`. Install Node.js dependencies with `npm ci`, then run `npm run auth:hash`. Enter the password at the hidden prompt and copy the verifier into `TODO_TRACKER_PASSWORD_HASH`, keeping single quotes around it so its dollar signs remain literal in environment files. Generate a separate random `SESSION_SIGNING_SECRET` with `openssl rand -hex 32`.

The server refuses startup when required password/session configuration is missing. An empty password hash never enables passwordless access. Local HTTP sessions use an HTTP-only, SameSite cookie; HTTPS deployments also use Secure cookies.

### Without a password

Set `TODO_TRACKER_AUTH_MODE=none` explicitly. You do not need a password hash or interactive session-signing secret in this mode. Every caller who can reach the server can access its tasks and owner actions.

Direct Node installations default to a loopback listener. Compose listens inside its private container network and publishes only `127.0.0.1:8888`; passwordless Compose use additionally requires `TODO_TRACKER_ALLOW_UNAUTHENTICATED_REMOTE=true` to acknowledge the non-loopback listener inside the container. Do not widen the published port or expose the container directly to an untrusted network.

An authenticated access gateway may protect a remote installation, but Todo Trackr does not verify that gateway's identity. Configure and test the gateway independently. Origin and Host validation do not replace network access control. Webhook and service-ingestion credentials remain independent of the interactive authentication mode.

## Start with Compose

```bash
docker compose --env-file .env.self-hosted up --build
```

Open [the local workspace](http://127.0.0.1:8888). The published port is fixed at 8888. If it is occupied, resolve the conflict before starting rather than creating a second instance on an unexpected port.

The app waits for PostgreSQL readiness, applies ordered migrations, and starts the server. PostgreSQL uses a named data volume and is not published on a host port. The application runs as the unprivileged Node user.

Stop with Ctrl+C in the same terminal. Stopping containers preserves database data. Do not remove the database volume as part of an ordinary restart or upgrade.

## Start from source

Configure `DATABASE_URL` for your own PostgreSQL instance and keep the runtime set to `standalone`. Use a fresh database or an installation with a valid migration ledger. Then run:

```bash
npm ci
npm run build:web
npm run build:server
npm run db:migrate
npm run start:server
```

Open [the local workspace](http://127.0.0.1:8888). Stop with Ctrl+C in the same terminal. The server does not fall back to another port if 8888 is occupied.

For a downloaded server archive, the compiled web/server files are already included. Install runtime dependencies with `npm ci --omit=dev`, copy and configure the environment example, then use `npm run db:migrate` and `npm run start:server`.

The migration runner locks the migration sequence, records checksums, and applies each migration and its ledger entry transactionally. It refuses changed migrations and legacy databases without a recognized ledger. Never point a test command at personal or production data.

## Connect the clients

In the Mac connection screen or extension popup, enter the exact server origin. Use `http://127.0.0.1:8888` when the server runs on the same machine. Remote client connections require an HTTPS origin. Paths, query strings, and embedded credentials are rejected.

The Mac app stores credentials per server in Keychain. The extension requests access to the server when you choose Connect and stores its credential in extension-local storage. Passwordless installations do not need a fabricated login credential. Fresh clients must not contact the maintainer's server; existing credentials support an explicit legacy migration.

A loopback address always refers to the device using it. To connect an iPhone or another computer, provide a deliberately configured private HTTPS endpoint and access boundary. Keep `TODO_TRACKER_PUBLIC_ORIGIN` equal to the exact public-facing origin. The server rejects unrecognized Host headers and browser origins.

The GitHub-distributed Chromium extension is loaded unpacked through the browser's extension page. It requires manual reload/update after replacing its files. A GitHub zip is not a browser-store installation or automatic extension-update channel.

## Notifications

Needs Attention remains visible in the task data without notification permission or Web Push configuration. The standalone alarm scanner claims due alarms atomically, and delayed runs are checked against the current task state before notification delivery. Restarting the server does not discard due alarms stored in PostgreSQL.

For browser notifications, configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` for your own installation, then opt in on each device. The native app can schedule local notifications with permission. Failed or unavailable notification delivery does not clear a task's Needs Attention state.

## Back up and upgrade

Export task JSON through System health for user-managed recovery. Keep it private; it contains task content and source links. JSON import uses an only-missing policy and does not overwrite live records or recreate Shortcut-managed tasks.

For a complete instance backup, use PostgreSQL backup tooling for the database and preserve the environment/secrets separately. Verify restoration into a fresh disposable database before upgrading. A source checkout, server archive, or Docker image does not contain the database volume or private credentials.

Upgrade only after reviewing release notes and preserving a backup. Run migrations using the new release, then start that release and check tasks, alarms, recovery, and client connections. An older application binary may not support a newer database schema; rollback requires a compatible database backup, not just an older executable.

## Validation and release evidence

`npm run test:self-hosted` uses disposable embedded PostgreSQL over a local Unix socket. It verifies the real PostgreSQL driver and application behavior without installing a database service. Its single-process connection multiplexing differs from a normal PostgreSQL server, so it does not prove container behavior or multi-process concurrency.

See the [release plan](self-hosted-release-plan.md), [security policy](../SECURITY.md), and [contribution guide](../CONTRIBUTING.md) for the remaining acceptance and maintenance requirements.

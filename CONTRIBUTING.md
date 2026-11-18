# Contributing

Todo Trackr is a single-owner, self-hosted task manager with web, native macOS, and Chromium capture clients. Changes should keep the core workflow usable without external work-system integrations.

## Development

Use Node.js 24 and install dependencies with `npm ci`. See [self-hosting](docs/self-hosting.md) for standalone configuration and [the existing setup guide](docs/setup.md) for the hosted deployment adapter and native build prerequisites. Use a disposable database for development, never the maintainer's personal instance.

Keep changes focused. Preserve task lifecycle, date-only due dates, optimistic concurrency, source attribution, and source-managed edit restrictions. Keep credentials scoped to the selected server and preserve unsaved drafts when reporting conflicts or failures.

## Validation

Run the checks relevant to the change:

```bash
npm test -- --maxWorkers=2
npm run typecheck
npm run check:migrations
npm run check:versions
npm run build:web
npm run build:server
npm run test:self-hosted
npm run test:macos-install
swift test --package-path apps/macos
```

The self-hosted integration suite creates its own disposable embedded PostgreSQL database and Unix socket, then removes them. It tests the PostgreSQL protocol path but does not replace a PostgreSQL container rehearsal, production backup verification, or multi-process concurrency testing.

Test behavior through module interfaces. For interface changes, review the rendered states and interactions in every affected client. A passing build or source-string assertion alone does not establish visual or installation acceptance.

## Pull requests

Explain the user-visible problem, resulting behavior, relevant tests, and remaining limitations. Link related issues and include screenshots or recordings for interface changes. Document migration, configuration, permission, and release changes alongside the implementation. Keep generated native release provenance consistent with the native source.

Report security-sensitive problems using [the security policy](SECURITY.md). Do not publish credentials or private task data in issues or pull requests.

Contributions are provided under the [MIT license](LICENSE). Preserve notices for bundled third-party software and fonts.

## Disposable web preview

From a source checkout with Node.js 24 and installed dependencies, build and run one temporary preview on fixed port 8888:

```bash
npm run build:web
npm run build:server
npm run preview:self-hosted
```

Open http://127.0.0.1:8888. The preview uses disposable embedded PostgreSQL data, explicit passwordless access, and no work-system integrations. It refuses an occupied port, stops automatically after nine minutes, and removes its temporary database on exit. Stop sooner with Ctrl+C in the same terminal. Do not use it for real task storage.

## Container rehearsal

With an existing Docker daemon, run `npm run rehearse:self-hosted`. It reserves loopback port 8888, builds the checked-out Dockerfile, creates a randomly named disposable Compose project, tests protected/passwordless access, concurrent editing, recovery/export, database backup/restore, and restart persistence, then removes its own containers and volumes. It never loads the repository's real environment files. The pass is bounded to nine minutes. Do not use its disposable database for real tasks.

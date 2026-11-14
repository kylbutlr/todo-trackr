# Public and personal build profiles

Todo Trackr has one shared Tasks client and an optional owner integration. The default is **public**. Tasks, personal lists, alarms, Quick Capture and the supported standalone server remain independent of any work-management provider. Existing optional hosted Shortcut, Granola and Codex adapters retain their installation capability checks.

## Public product

From the repository root, with Node.js 24:

```sh
npm run build:web
npm run build:server
npm run package:extension
swift build --package-path apps/macos --scratch-path apps/macos/.build-public --jobs 1
```

The public Docker build context also excludes owner packages and journals. The public native target has no personal library, receiver, metadata reader, provider views or scheduler. Its integration factory is empty. Public web settings and server routes are empty integration slots. The public extension is Quick Capture only and requests no native messaging permission. A saved unavailable provider selection falls back to Tasks without editing saved preferences or changing source history.

The public extension composition lives in `apps/browser-extension-public`. Capture, connection, styling, fonts and icons are shared with `apps/browser-extension`. Packaging explicitly selects the public entrypoints, never the locally loaded owner entrypoints.

`npm run package:source` still requires clean, committed, reviewed source. It filters owner-only files out of the source archive. `node scripts/prepare-public-source.mjs OUTPUT_DIRECTORY` prepares an explicitly labeled local review export from current source without making a release. The export does not contain the local personal package. Public server packaging verifies content hashes from both public build receipts before copying compiled output, and filters private journals from its documentation. A stale profile label cannot validate replaced JavaScript.

## Public validation

`npm run test:profiles` packages and checks only the public extension by default. It works from the public source export without private files and is included in public CI. `npm run test:profiles:personal` explicitly adds personal extension assertions when the local owner package is present. The standalone integration suite uses a disposable database and verifies capture, editing, stale-write rejection, alarms, recovery and authentication with provider adapters disabled.

## Local personal variant

`TODO_TRACKR_BUILD_PROFILE=personal` explicitly selects the local owner package. Native personal sources and tests live under `apps/macos/Personal`; private hosted support and web settings live under `personal`. These directories are Git-ignored and are not public dependencies. Missing personal source or an unknown profile fails instead of silently building another variant.

```sh
TODO_TRACKR_BUILD_PROFILE=personal swift build --package-path apps/macos --scratch-path apps/macos/.build-personal --jobs 1
npm run package:extension:personal
npm run build:web:personal
npm run build:server:personal
```

Personal packaging has distinct artifact names and build output paths. Personal native builds cannot use the public Sparkle release channel. Both native variants preserve the established app identity; the installer refuses cross-profile replacement, including legacy private bundles identified by their receiver. Coexistence under separate bundle identities would require a separately reviewed data and Keychain migration. This preparation does not attempt that migration.

## Installed integration and history

No installed app, defaults, Keychain items, native-host registration, extension permissions or metadata ledgers are migrated by build selection. The currently loaded unpacked extension tree is intentionally frozen during this preparation. Its owner entrypoints are excluded from public source and extension artifacts. Do not reload or replace it as part of public packaging.

The personal adapter continues to own its browser acquisition, account/workspace identity, saved-read formats, Storefront and completion presentation, fixed budgets and scheduling gates. The shared `WorkIntegration` interface owns only optional views and lifecycle actions. It has no task-write or reconciliation API. Radar reconciliation and automatic two-way synchronization remain disabled.

Rollback is source-only: the pre-change source backup is retained in the local review directory. Do not restore installed apps or user data for this structural change. Signing, installation, extension activation, service reads, public release and personal-to-public profile migration remain separate acceptance steps.

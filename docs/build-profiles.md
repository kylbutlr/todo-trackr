# Public and personal build profiles

Todo Trackr has one shared Tasks client and an optional owner integration. The default is **public**. Tasks, personal lists, alarms, Quick Capture and the supported standalone server remain independent of any work-management provider. Existing optional hosted Shortcut, Granola and Codex adapters retain their installation capability checks.

## Repository ownership

- [Public Todo Trackr](https://github.com/kylbutlr/todo-trackr) owns the general-purpose app, reusable shared behavior and public releases.
- [Private Todo Trackr companion](https://github.com/kylbutlr/todo-trackr-personal) owns Kyle's versioned personal integration source, explicit overlays/patches and restore/build instructions. It is optional for public contributors. Read its agent instructions and public commit pin before personal edits.
- Credentials, signing private keys, runtime preferences, task history and service receipts belong outside both repositories. Private Git is a source backup, not a credential vault or a user-data restore.

Personal changes should be recorded in the companion and verified by composing a new tree from its pinned public commit. Ignored files under a public checkout and disposable composed trees are working copies; do not leave the only current fix there. Preserve newer unrecorded edits before updating the companion. Keep its file hashes and patch expectations aligned with reviewed changes.

Shared Tasks, alarms, connection or reusable integration improvements belong in a separately reviewed public change. After that change merges, deliberately update the companion's public pin and reconcile affected patches. A reusable connector's presence in a personal overlay or local candidate does not prove it is in the public release. Do not automatically mirror repositories, copy private settings into shared defaults or merge an older personal branch wholesale.

## Agent routing before edits

Kyle can be running the local personal Radar variant while GitHub distributes the public/default product. Their release numbers and installed state are independent. Determine the requested target from the task and verify the local profile before choosing source files or an artifact.

Route “my Mac app” to the verified installed profile. Explicit public/GitHub/self-hosted requests target the public product. Resolve any remaining ambiguity before changing either profile; do not silently convert installations.

| Request | Source boundary | Validation |
| --- | --- | --- |
| Public task-management or self-hosting work | Public/default client and server | Public build, profile isolation and relevant standalone checks |
| Kyle-specific Radar acquisition, auth handling, refresh, saved-ticket display or diagnostics | Private companion overlay and owner extension composition | Explicit personal build with synthetic data; activation and service acceptance separately authorized |
| Provider-independent behavior used by both variants | Generic shared core or integration seam | Public checks plus the affected personal tests |
| Public release | Explicit public artifacts only | Public release gates; no personal binary, mappings or journals |
| Update Kyle's Mac installation | Verified personal candidate only | Same profile, newer compatible version, guarded install and explicit quit/install authorization |

Do not infer a defect from missing private files in a fresh public checkout. Do not add Radar dependencies to public startup to make that checkout resemble Kyle's installed workspace. When a personal package is unavailable, identify that source gap instead of inventing a replacement or borrowing Codex credentials. Preserve source history and keep reconciliation/two-way synchronization disabled.

Some browser capture assets are shared between profiles. Follow the explicit entrypoint composition and packaging filters instead of treating all of `apps/browser-extension` as either public or private. Never force-add ignored owner files to the public repository.

Before installing, inspect the exact app path. Backups can share the bundle identifier, so identifier-only app lookup may select the wrong copy. Prefer the explicit `TodoTrackrBuildProfile` key; for a legacy app without it, the existing receiver distinguishes the personal profile. Both profiles intentionally share an app identity and user-data location, and cross-profile replacement is not an update strategy.

The root [agent instructions](../AGENTS.md) make this routing mandatory. Local instruction edits only protect checkouts containing them; future fresh clones receive the guidance after the documentation change is reviewed and merged. Do not assume an unpushed local fix is present in another checkout or installed build.

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

The personal Mac build defaults to the existing hosted Todo Trackr server even when no session is available or Keychain is locked. A remembered valid origin and an explicit development environment override still take precedence. The public build retains its standalone default and legacy-session compatibility. A changed server is remembered only after login or passwordless session validation succeeds; a failed connection does not replace the last working origin. Signing out removes the session, not the remembered server. Credentials remain scoped to each server, and this policy does not migrate installed settings or history.

## Installed integration and history

No installed app, defaults, Keychain items, native-host registration, extension permissions or metadata ledgers are migrated by build selection. The currently loaded unpacked extension tree is intentionally frozen during this preparation. Its owner entrypoints are excluded from public source and extension artifacts. Do not reload or replace it as part of public packaging.

The personal adapter continues to own its browser acquisition, account/workspace identity, saved-read formats, Storefront and completion presentation, fixed budgets and scheduling gates. The shared `WorkIntegration` interface owns only optional views and lifecycle actions. It has no task-write or reconciliation API. Radar reconciliation and automatic two-way synchronization remain disabled.

Rollback is source-only: the pre-change source backup is retained in the local review directory. Do not restore installed apps or user data for this structural change. Signing, installation, extension activation, service reads, public release and personal-to-public profile migration remain separate acceptance steps.

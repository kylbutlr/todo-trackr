# Self-hosted release plan

Status: self-hosted foundation implemented locally; release verification incomplete. Updated October 22, 2026.

The public version and GitHub tag target are **v1.0.0**. All client/package metadata uses 1.0.0; the native build number is 1000000. The Mac app is distributed as source only, per the clarified release scope. A paid Apple membership, prebuilt Mac download, and notarization are not required. No public release or tag has been created.

Todo Trackr will be an open-source task manager that one owner runs for their own use. The web app, macOS app, and Chromium Quick Capture extension share that installation. GitHub Releases will provide the downloads, and the portfolio will direct visitors to the repository and release page.

The first release must work without Shortcut, Granola, Codex, App Switchr, or an account on the maintainer's infrastructure. Password protection is optional and explicitly configured by the installation owner. Existing installations retain their current authentication and data until their owner deliberately changes them.

## Problem statement

The current capture, organization, attention, and recovery behavior is useful, but the implementation assumes one particular owner's deployment and work ecosystem. Identity matching, integration configuration, workflow ordering, client endpoints, operational screens, and documentation expose those assumptions. The API and database are coupled to Netlify and Neon; server-delivered alarms use Trigger.dev. Downloading the clients does not provide an independent server installation.

The release needs a complete installation and upgrade path, predictable behavior without integrations, configurable clients, and verified downloads. Repository presentation should explain the product, supported behavior, and maintenance process in straightforward language.

## Solution

Keep one owner per installation and preserve the task model. Put installation configuration, authentication, persistence, scheduling, and optional integrations behind explicit interfaces. Provide a standalone server and PostgreSQL deployment with a documented container configuration. Retain the current hosted deployment adapter during the transition.

Make the core task experience the default. Treat source attribution, connected-system lifecycle rules, and automation controls as capabilities of optional integrations. Adding or disconnecting an integration must not rewrite existing tasks unexpectedly.

### Optional password protection

- Require an explicit installation setting to enable passwordless access. Missing, misspelled, or invalid configuration must never silently disable authentication.
- Preserve password protection for existing installations, including their password verifier and signed-session behavior.
- Bind the standalone server to loopback by default. Publish container ports on loopback by default as well.
- Explain during setup that passwordless mode gives every caller who can reach the instance access to its task data and owner actions.
- Support passwordless use on the owner's machine or behind deliberately configured private access controls. An upstream gateway remains responsible for its authentication; Todo Trackr must not claim to have verified that identity.
- Enforce allowed-host and browser-origin checks for local access, including passwordless mode. Validate the actual network/proxy configuration; do not infer trust from arbitrary forwarded headers or a client-supplied hostname.
- Apply the selected mode consistently to web, native, and extension connections. Passwordless clients must connect without a dummy password or fabricated credential.
- Keep webhook signatures, ingestion tokens, delayed-job authorization, and integration credentials independent of the interactive password setting.
- Test changes between authentication modes, including stale sessions, cached data, reconnect behavior, and unsaved task drafts.

### Client connections

Provide server selection in normal setup and settings, rather than requiring source edits or developer environment overrides. Validate and normalize addresses. Allow plain HTTP for explicit loopback development/local use; use HTTPS for remote client connections.

Isolate credentials and cached state by server origin. Switching servers must cancel old requests, clear private in-memory state, and prevent late responses from repopulating the wrong instance. Quick Capture must identify its destination and report failures honestly. Preserve captured text for retry where appropriate. Native Accessibility and extension active-tab access remain user-initiated.

### Optional integrations

The default installation must require no work-system credentials and perform no disabled-integration polling. Unconfigured integrations must not break core startup or make overall health appear broken.

Replace personal names, member IDs, organization custom-field IDs, workflow names, and fixed workflow ordering with configured or discovered connection data. Preserve the current installation's mappings through an explicit migration and verify them before enabling reconciliation.

Represent supported task actions and source-owned fields as integration capabilities. Preserve manual-task behavior, source-managed lifecycle rules, task history, source links, deduplication, and approval semantics. Experimental integration behavior belongs in its own settings and documentation.

## Implementation increments

Each increment should leave the existing deployment usable and pass focused behavioral checks. These describe implementation increments, not commits already created. See the progress section below for current evidence.

1. **Record scope and refresh the repository overview.** Separate current capabilities from planned distribution. Document single-owner installations, optional passwords, optional integrations, and GitHub downloads. This documentation is the first local increment.
2. **Introduce installation capabilities.** Define a small response describing authentication mode, supported client features, and compatibility version. Return no secrets, personal data, or unneeded deployment details. Keep existing clients compatible.
3. **Separate request handling from hosting.** Preserve route behavior and validation while enabling the same handler to run in a standalone Node process.
4. **Introduce a PostgreSQL persistence interface.** Preserve SQL semantics, transactions, optimistic-lock precision, and recovery behavior. Exercise hosted and standalone database implementations through the same behavior tests.
5. **Package the standalone server and database.** Add versioned container build inputs, loopback defaults, persistent volumes, health/readiness checks, explicit secrets, and ordered migrations. Document installation, backup, restore, upgrade, and rollback using the packaged commands.
6. **Implement optional passwords across clients.** Add configuration validation, mode discovery, access checks, and connection behavior. Keep existing deployment settings and service authentication unchanged. Verify protected and passwordless modes before describing either as supported.
7. **Add native server setup.** Provide server selection, origin-scoped Keychain entries, and passwordless connection behavior. Preserve the current installation and verify server switching in the workspace, Mini Trackr, and Quick Capture.
8. **Add extension server setup and packaging.** Request only destination permissions needed for the chosen server. Cover protected/passwordless instances, expiry, unreachable servers, and retries. Produce a versioned GitHub download with unpacked-install and manual-update instructions.
9. **Make integration availability optional throughout clients.** Keep disconnected providers out of the default workspace. Isolate diagnostics and repair schedules from task loading. Remove employer-specific defaults from fresh installations.
10. **Generalize existing integration configuration.** Migrate the current owner's mappings explicitly, then test an unrelated identity, fields, and workflow ordering. Preserve pause, deduplication, approval, and completion semantics.
11. **Provide self-hosted alarm scheduling.** Use durable database-backed scheduling with restart recovery, reschedule/cancel handling, idempotent delivery, and late-callback checks. Keep native notifications and optional Web Push explicit. Retain Trigger.dev as an optional adapter.
12. **Separate application modules at behavior seams.** Extract task workspace/editor behavior, connections, sessions, and synchronization coordination. Keep API contracts explicit and test native/web compatibility. Avoid unrelated refactoring solely to reduce line counts.
13. **Prepare contributor and release documentation.** Add the chosen application license, contribution instructions, security contact/process, supported-platform table, changelog, privacy/data-flow explanation, and third-party notices. Separate machine-specific recovery notes from normal user setup.
14. **Include native source with an honest build path.** Compile/test the Swift app, document the free local-signing workflow, and disable binary update checks in source builds. Preserve existing private update archives. Prebuilt notarized Mac distribution is a future option, outside v1.0.0.
15. **Rehearse a complete release.** Install the server from a clean download, connect both clients, test both password modes, upgrade an earlier version, restore a backup, and verify checksums and public downloads. Add the portfolio link after those checks pass and publication is authorized.

## Testing decisions

Test behavior through module interfaces. Source-string assertions may enforce a narrow static rule, but they do not prove a successful task operation, authentication decision, database transaction, client connection, or release installation.

Use existing task-validation, authentication, Quick Capture, alarm, synchronization, and guarded-installer behavior as regression references. Add real PostgreSQL tests and cross-client end-to-end coverage for the installation model.

Required acceptance checks:

- A clean installation captures, organizes, edits, completes, deletes, restores, and exports tasks with every integration disabled.
- Password-protected mode rejects unauthorized task, recovery, configuration, and notification requests.
- Explicit passwordless mode connects without a password prompt or password verifier. Service-authenticated endpoints continue enforcing independent credentials.
- Invalid/missing authentication configuration cannot turn a protected installation into an open one.
- Loopback publication, allowed hosts, browser origins, and proxy assumptions work in the actual standalone/container deployment.
- All three clients connect to a second independent server without leaking credentials, cached tasks, capture destinations, or late responses across instances.
- Integration mappings work for identities and workflows unrelated to the personal setup.
- Persistent alarms survive restart and do not deliver after cancellation, completion, deletion, or an obsolete reschedule.
- Migrations and backups work against a disposable database, including an upgrade from an earlier release and verified restore.
- The packaged extension works in the target Chromium browser. Document its manual update process; GitHub packaging does not establish automatic browser updates.
- Native source compiles/tests, documents local builds, and has no enabled binary update feed. No prebuilt native artifact is part of this release.
- Rendered review covers affected web, extension, native workspace, Mini Trackr, and Quick Capture states, including failures and connection states.
- Release assets, checksums, installation commands, version metadata, source provenance, and update-feed references agree.

## Decision document

- One owner uses each installation in v1. Separate installations provide separation between owners.
- A maintainer-operated hosted multi-account service is outside this release.
- Password protection is optional through an explicit installation choice. The current installation remains protected unless its owner changes it.
- GitHub Releases is the download destination; the portfolio is the discovery entry point.
- Web/server archives and the unpacked extension are release downloads. The Mac source remains included and validated, with local build instructions; a prebuilt Mac app is outside v1.0.0.
- All external work-system integrations are optional.
- A standalone server/database package is part of self-hosting. User-owned Netlify/Neon deployment may remain supported, but it does not establish standalone operation.
- Preserve the pinned visual foundation while improving hierarchy, terminology, onboarding, and settings.
- An open-source license is required before publication. The application uses the MIT license; bundled third-party notices remain in force.
- Keep the existing consolidated Git history. Preserve old worktrees and release evidence; no additional rewrite is part of productization.

## Out of scope

Multi-account hosting, team workspaces, billing, collaboration, an integration marketplace, and a hosted control plane are outside v1. Browser-store publication is outside the GitHub-download distribution path.

This plan does not change production task data, credentials, deployment settings, signing material, or installed applications. Publishing releases, changing repository visibility, pushing branches, merging, and updating the portfolio are separate delivery actions.

## Release gate

The current code remains a personal deployment while these requirements are implemented. Documentation and unit tests alone do not establish a working self-hosted release. Declare readiness only after a clean independent server installation, password-mode coverage, extension connection checks, migration/restore rehearsal, web QA, native compilation/tests, and downloadable-artifact verification pass. Native installed behavior remains an explicitly documented source-client acceptance limit.

## Current progress

Implemented locally: installation capabilities, explicit standalone authentication modes, PostgreSQL persistence with transaction-scoped batches, ordered checksum-tracked migrations, standalone HTTP/static serving, database-backed alarm scans, container configuration, web integration gating, extension server setup, native server/credential handling, MIT licensing, contributor/security guidance, and local server/extension packaging.

Verified in this working session: 297 JavaScript tests, 91 native tests in 23 suites, 15 guarded-installer tests, TypeScript checks, both builds, 17 contiguous migrations, unified 1.0.0 versions, five embedded PostgreSQL protocol integration tests, and local archive generation. The extracted server archive installed all 138 runtime packages successfully from the local npm cache, with install scripts disabled; its temporary directory was removed. This checks archive/lockfile consistency, not a full independent installation. The database suite exercises fresh schema creation, migration reruns, task edit/conflict/delete/restore/export, transaction rollback, alarm delivery/cancellation, and protected local login. A new regression proves standalone work ignores inherited App Switchr settings without contacting its service or hosted storage.

Rendered standalone web review covered passwordless startup, no disabled-provider navigation or Codex editor, capture/edit, alarm persistence/clearing, completion, healthy core diagnostics, and a 390px viewport without horizontal overflow. A deferred input-event bug found during review was corrected so saved dates persist. The passwordless status footer was corrected and re-reviewed. All task-owned tabs and preview processes were closed, port 8888 was verified closed, and disposable databases were removed.

Production dependency audit after compatible Trigger.dev updates: zero reported vulnerabilities. Compatible Vite/Vitest/source-map updates also reduced development-only advisories; remaining development findings are tracked separately from the runtime. The automatic UI detector reported an overused-font warning for the extension; the pinned App Stylr typography was retained. A narrow credential-pattern scan found no matches, which is not a comprehensive security audit.

Remaining production gates:

- Docker/PostgreSQL rehearsal passed using a task-specific, two-CPU/2-GB Colima VM: clean image build, non-root runtime, loopback app publication, no database port publication, no integration gates, concurrent edit conflict, task recovery/export, database dump restored into a second database, task/alarm persistence after restart, migration reruns, password-mode transition, unauthorized protection, and real session cookies. All rehearsal containers, networks, volumes, and temporary configuration were removed. The task-created VM and image cache were then stopped and deleted. Installed Homebrew Docker/Compose/Colima tools remain available. This does not prove production upgrades from an earlier independently deployed release.
- Review the installed extension in Chromium, including host permission prompts, both password modes, switching servers, and capture. The existing Chrome extensions page could not be claimed by browser automation, so no installation/reload was performed. Automated capture-flow tests cover destination selection, passwordless headers, protected-session expiry, and rejecting a capture if its server changes. Mac installed behavior remains a documented source-client acceptance limit; the public release includes source only.
- Validate the source-only Mac release policy and local build path. Source builds have no binary update feed. The release checker requires version consistency and prevents signed assets from being modified under source-only distribution. A future binary release retains a separate, deliberate signing policy.
- Runtime advisories are resolved. Four development-only findings remain: Vitest/mocker path traversal or code injection (two moderate package findings) and recursive deep-merge stack exhaustion through the unused Prisma build extension (two high package findings). Automated tests run without a public test server, and this project does not enable the Prisma extension. No unsupported major-version override was applied. See the dependency notes below.
- Verify the published v1.0.0 assets and checksums after separately authorized GitHub publication, then update the portfolio link.

General-purpose legacy integration mappings and broader workspace/module extraction remain follow-up engineering work. They are not advertised standalone v1 capabilities; enabling a legacy integration in standalone mode is rejected rather than applying personal defaults. Test and packaging evidence must be refreshed after relevant changes.

## Dependency notes

The final production audit reports zero vulnerabilities after updating Trigger.dev to 4.7.7. Compatible Vite/source-map updates also removed their high-severity findings. Remaining findings affect development tooling only:

- Vitest and its mocker: [mock redirect traversal](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) and [manual mock registration](https://github.com/advisories/GHSA-qxg6-89mg-rqv8). Do not expose a Vitest development/browser server to untrusted clients. CI uses `vitest run`.
- `@prisma/config` and `deepmerge-ts`, pulled by Trigger.dev build tooling: [recursive-object stack exhaustion](https://github.com/advisories/GHSA-ggr8-5vv4-36mx). This repository does not enable Prisma build extensions or merge untrusted Prisma configuration. Keep the upstream dependency update on the maintenance backlog.

These packages are omitted from the production server installation. The checked container runs the standalone alarm worker rather than Trigger.dev. The dependency assessment does not establish that all future use of development tooling is safe.

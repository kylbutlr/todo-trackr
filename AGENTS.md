## Public product versus Kyle's personal installation

Before changing native, extension, integration or release behavior, read [the build-profile contract](docs/build-profiles.md) and identify the target profile. If that document is absent on an older personal checkout, read `git show origin/main:docs/build-profiles.md` after fetching; do not switch or reset an occupied checkout.

- [Public Todo Trackr](https://github.com/kylbutlr/todo-trackr) owns the general-purpose app and reusable shared fixes. [Kyle's private companion](https://github.com/kylbutlr/todo-trackr-personal) owns versioned personal additions, explicit overlays/patches and restore/build instructions. Public users and contributors do not need companion access.
- For personal work, read the companion's agent instructions and `upstream.lock.json`; edit its source overlay and update reviewed hashes/patches. Composed trees and ignored copies in public checkouts are build/working copies, not the only durable source. Preserve any newer unrecorded edits before reconciling them. Shared improvements require a separate public change and deliberate companion-pin/patch update, never an automatic merge or public push of private code.
- A repository link or source commit does not establish the installed app version, loaded extension, credentials or history. Verify those separately. Missing private access is a specific personal-source gap, not a reason to add personal dependencies to public startup.

- The public/default product and Kyle's installed personal app are different build profiles. Do not assume the installed app matches the GitHub release or that their version numbers should match. Verify the exact installed bundle's `TodoTrackrBuildProfile`, version and helper presence; legacy private bundles may lack the profile key but contain `RadarNativeHost`. Use the full bundle path when backups share its identifier.
- Route “my Mac app” to the verified installed profile; route explicit public/GitHub/self-hosted work to the public product. If read-only inspection still leaves the requested target ambiguous, ask one concise question rather than converting profiles or choosing a different installation.
- Public/default work must remain usable without Radar, SDG access, Kyle's hosted account, Chrome native messaging or the private package. Missing personal files in a public clone are expected.
- Kyle-specific Radar acquisition, authentication handling, refresh scheduling, saved-source presentation and diagnostics belong in the local personal integration package. Native sources/tests are under `apps/macos/Personal`; private hosted/web composition is under `personal`. Keep private extension entrypoints separate from shared capture assets. Do not force-add ignored private code, credentials, mappings or real data to public Git history.
- Shared Tasks, alarms, server-connection and other provider-independent fixes may belong in shared source. Keep that boundary generic and validate the public profile plus the affected personal path. A private Radar fix does not authorize a public release; a public release does not authorize replacing Kyle's installed app.
- Preserve the installed personal app, preferences, history, native-host registration and loaded extension unless the current task explicitly authorizes changing them. Never install a public build over the personal profile, merge an older personal branch wholesale into main, or enable reconciliation/two-way sync as an incidental change.
- Report public-source validation, private-source validation, signed preparation, installation and live-service acceptance separately. Installation, extension activation, service reads, Git pushes and publication retain their separate approval boundaries.

## App Stylr

This app follows [App Stylr v1.4.1 source](https://github.com/kylbutlr/app-stylr/tree/v1.4.1).

### Required visual review

Before implementing or reviewing interface work:

1. Open the rendered [App Stylr Visual Reference](https://kylbutlr.com/app-stylr) and [App Stylr Style Guide](https://kylbutlr.com/app-stylr).
2. Review the relevant hierarchy, typography, spacing, controls, states, access posture, responsive behavior, accessibility, and product voice before making UI decisions.
3. Implement with the pinned App Stylr tokens and adapters. Do not sample or approximate values from screenshots.
4. Compare the rendered app against both guides at the relevant viewports and interaction states before considering the interface complete.
5. Record every intentional difference in `docs/app-stylr-exceptions.md`.

The rendered guides show current App Stylr guidance. The pinned release remains this app's implementation source of truth. If current guidance requires a newer release, upgrade the pin deliberately before adopting it. Do not silently mix versions.

- Use App Stylr semantic tokens instead of copying raw palette colors.
- Treat App Stylr typography, spacing, radius, motion, accessibility, icon, content, and naming rules as defaults.
- Style the creator handle exclusively as `kylbutlr`, lowercase with no spaces. Never use uppercase, title-case, or spaced variants.
- Start personal productivity and utility apps with the dark theme unless a product requirement calls for another appearance.
- Decide whether a new app is public or private during setup. Private apps on public hosting must follow the App Stylr auth-ready baseline: checking, signed-out, signed-in, and expired-session states; working Sign out; server-side verification; protected private APIs; and no client-exposed secrets. Never ship cosmetic authentication controls.
- Keep the pinned App Stylr version explicit. Do not silently follow a moving `main` branch.
- Keep `app-stylr.json` aligned with the pinned release and default theme.
- Record intentional differences in `docs/app-stylr-exceptions.md` using the App Stylr exception template.
- When App Stylr and a documented product requirement conflict, follow the product requirement and record the exception.

## Repository-specific notes

- `app-stylr.json` records the release pin and dark default theme.
- `design/tokens.json`, `design/app-stylr.css`, and `apps/macos/Sources/Design/AppStylrTokens.swift` are vendored from the pinned release. Replace them from one release together instead of editing them independently. Native adapter changes require source compilation/tests. Include a matching signed update only when the release explicitly distributes a native binary.
- Todo Trackr supports single-owner standalone installations and a legacy protected hosted adapter. Preserve server-enforced access in password mode, explicit standalone-only passwordless configuration, and credentials scoped to the selected server.
- `apps/web/src/styles.css` and `apps/macos/Sources/Design/DesignTokens.swift` adapt the shared tokens to each client.
- Todo Trackr's domain language is defined in `CONTEXT.md` and remains authoritative for product terminology.

## Visual foundation maintenance

Keep Sage/dark/Normal defaults, precise 4px controls, 8px cards and 12px dialogs, and quiet semantic feedback. Preserve product layouts and existing glyphs. Keep a scalable SVG master and inspect 16/32px legibility plus 128/512px Retina quality. Use the neutral Graphite base independently of accent palettes. Shared adapters are generated or vendored from the exact public v1.4.1 source, never edited independently.

## App Stylr

This app follows [App Stylr v1.2.0 source](https://github.com/kylbutlr/app-stylr/tree/b3ca31ea264d5dd233fd871ac167247f1c306985).

### Required visual review

Before implementing or reviewing interface work:

1. Open the rendered [App Stylr Visual Reference](https://app-stylr.netlify.app/reference/) and [App Stylr Style Guide](https://app-stylr.netlify.app/reference/style-guide.html).
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

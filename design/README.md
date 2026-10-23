# Todo Trackr design foundation

Todo Trackr adopts [App Stylr v0.3.0](https://github.com/kylbutlr/app-stylr/tree/v0.3.0) as its visual and interaction source of truth. The root [`app-stylr.json`](../app-stylr.json) records the release pin.

- `tokens.json` is the canonical token snapshot from the pinned release.
- `app-stylr.schema.json` validates that token snapshot.
- `app-stylr.css` is the generated web adapter consumed by `apps/web/src/styles.css`.
- `apps/macos/Sources/Design/AppStylrTokens.swift` is the matching generated Swift adapter.
- The Swift adapter retains its v0.1.1 version marker until the next signed macOS release. App Stylr v0.3.0 keeps the same semantic token values, and the temporary difference is recorded as a [documented exception](../docs/app-stylr-exceptions.md).
- The web client self-hosts the pinned Geist Sans and Geist Mono variable web fonts.
- The macOS client bundles and registers the matching Geist variable fonts.
- `GEIST-LICENSE.txt` contains the upstream SIL Open Font License.

## Todo Trackr theme

Todo Trackr uses a dark-first product theme across the web and macOS clients. This is an intentional product-level extension of the shared palette:

- Ink and Charcoal anchor the canvas and navigation surfaces.
- Mint remains the primary accent and selected-state color.
- Sage is reserved for secondary accents and supporting metadata.
- Elevated surfaces, borders, and text use explicit dark-mode semantic tokens from `tokens.json` so native controls and custom surfaces maintain readable contrast.

Both clients currently render in dark mode by default rather than following the system appearance. A user-selectable appearance setting can be added later without changing the shared semantic tokens.

Intentional product exceptions are recorded in [`docs/app-stylr-exceptions.md`](../docs/app-stylr-exceptions.md).

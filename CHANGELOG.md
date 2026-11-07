# Changelog

## 1.1.1

- Resume Quick Capture server setup after Chrome closes the popup for its native site-access prompt, without repeating the server URL or Connect action.

- Make native-source verification work in downloaded source archives without Git metadata, while preserving checkout digests and excluding local build/editor state.

- Update Vitest within v4 and remove the unused Trigger build helper from development dependencies. The SDK and optional hosted integration remain unchanged.

- Patch development image tooling while retaining the exact App Stylr visual-source pin.

- Add labeled phone navigation for task views, custom lists, enabled sources, and settings.
- Keep phone task saving and conflict feedback in the sticky editor header, with a shorter notes area.
- Update Zod and the locked systeminformation resolution to clear runtime dependency advisories.
- Refresh installation, extension, packaging, and source-only Mac documentation.

## 1.1.0

- Pin the shared visual foundation to App Stylr v1.4.1, with charcoal surfaces, Sage accents and precise controls.
- Replace green icon backgrounds with the neutral Graphite treatment and retain scalable masters plus high-resolution exports.
- Refresh the public still and animated previews from the actual interface using fictional data.

## v1.0.0

- Add an independent Node.js/PostgreSQL server and container configuration.
- Support explicit optional password protection across clients.
- Add server selection and server-scoped credentials to the Mac app and extension.
- Keep task management independent of work-system integrations and App Switchr.
- Add database-backed alarm scheduling and ordered, checksum-tracked migrations.
- Package versioned server and Chromium extension downloads.
- Add MIT licensing, contribution instructions, and security and privacy documentation.

Mac source is included, with manual local builds and no binary update feed. A paid Apple Developer membership and notarized Mac download are outside this release. The initial release includes a container rehearsal and automated checks. Installed-extension acceptance is separate from those checks. Existing private-deployment history is retained in recoverable repository backups rather than reproduced as public release notes.

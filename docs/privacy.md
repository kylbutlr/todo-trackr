# Privacy and data flow

A standalone Todo Trackr installation stores its owner's tasks, lists, task history, source links, recovery records, notification subscriptions, and settings in the configured PostgreSQL database. The installation owner controls that database and its backups. Exported JSON contains private task content and links.

The browser extension sends a user-triggered selection or page title and source URL to the selected Todo Trackr server. It does not continuously read browsing history. The Mac companion requests Accessibility permission for selected-text capture and notification permission for local reminders. Denying either permission does not give the app additional access.

Protected installations use signed sessions. The web client uses an HTTP-only cookie; the Mac client uses Keychain; the extension uses extension-local storage. Passwords are verified by the server and are not retained by companion clients. Passwordless installations deliberately allow any caller who can reach the instance to access owner data and actions.

The standalone core does not require the maintainer's server, App Switchr, Shortcut, Granola, Codex, Neon, Netlify, or Trigger.dev. Legacy hosted integrations have separate data flows and are disabled in the standalone runtime. Existing source links remain task data when an integration is unavailable.

Optional Web Push sends notifications through each browser's push service using the installation's own VAPID configuration. The Mac app can schedule local notifications. Native automatic-update checks use the update feed bundled with that native release, independently of the selected task server. Review the feed before distributing a native build.

Server operators control application hosting logs, database retention, reverse-proxy logs, backups, and network exposure. Todo Trackr cannot verify an upstream gateway's identity policy. Do not put a passwordless installation on an untrusted network.

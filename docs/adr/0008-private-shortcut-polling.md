# Poll Shortcut privately with scheduled reconciliation

Status: Superseded by [ADR 0011](./0011-remove-high-frequency-database-polling.md).

The private single-user Shortcut connector does not require a workspace-visible outgoing webhook. In Automatic mode, Todo Trackr searches for Stories updated during a rolling 5-minute window every 2 minutes, then reconciles only those Story references. A full reconciliation runs every 15 minutes, and the existing manual Sync action remains available.

The overlap makes incremental polling resilient to delayed scheduled runs while reconciliation fingerprints keep repeated observations idempotent. This approach trades instant webhook delivery for a short polling delay, avoids exposing the personal Todo Trackr endpoint in Shortcut workspace Integrations, and retains the full repair as the correctness backstop.

The authenticated Shortcut webhook endpoint remains supported but optional. It can be used later if the connector moves to an approved shared integration model.

# App Switchr integration

App Switchr is an optional adapter for the legacy hosted deployment. Standalone Todo Trackr works without it, ignores inherited Switchr environment settings, and advertises that no permission gate is needed. Standalone web and Mac clients do not poll the work-state endpoint.

The following configuration applies only to an explicitly configured hosted adapter.

## Configuration

Set these secret Production Functions values alongside the existing Todo credentials, then deploy:

- `APP_SWITCHR_URL`: the shared service's HTTPS `/api/work-state` URL.
- `APP_SWITCHR_READER_TOKEN`: the shared service's read-only credential.

Use a separate service/site and non-production database for development. Never expose the token in web/extension bundles or previews. No switch-specific Neon migration is needed. Both variables absent retains existing behavior; partial/invalid configuration fails closed for automatic work.

## Behavior

- Visible native/web clients check authenticated `/api/work-state` every 30 seconds. That proxy verifies the Todo session and reads the control service without querying Neon. A local distributed notification from App Switchr prompts the Mac client to check sooner; it is an invalidation, not trusted state.
- Automatic task/list/board/diagnostic and native Shortcut refresh loops require a valid active permission. The lease lasts at most 60 seconds, is reduced by request duration, and expires at the shared cutoff. A failed check pauses automatic work immediately.
- Detecting activation refreshes the UI and requests catch-up. Completion of pending catch-up refreshes it again. Deliberate opening, saving, capturing, refreshing and scheduled attention alarms keep their existing paths.
- Scheduled Shortcut/Granola handoffs and workers check the switch before database work. Already-started work can finish safely after standby.
- With configuration enabled, verified Shortcut/Granola webhooks and trusted ingestion are stored in a site-owned Blobs inbox before acknowledgement. They do not touch Neon at receipt. Invalid signatures are rejected before persistence. Storage failure returns an error so senders can retry.
- Configured Codex ingestion returns `202 {"deferred":true}` instead of an immediate session response. Granola ingestion uses the same deferred acknowledgement. Senders must accept that documented response. Codex patches replay in receipt-key order under the shared drain lock.
- Active clients request `/api/work-resume` while catch-up is pending. The worker drains at most 100 items, checks permission between items, and runs one source reconciliation for the completed revision. A shared lease prevents overlapping drain workers. Failed/in-progress events remain in the inbox. Abandoned database claims can be retried after ten minutes; a crashed drain lease expires after sixteen minutes.
- The six-hour repair jobs also attempt catch-up. Without a running client, activating App Switchr does not immediately start a hosted worker. Remote instant push and direct controller-to-worker wake remain future work.

The status text reports automatic work paused, unavailable or catch-up pending. It does not claim that every device acknowledged the switch. The Quick Capture extension is a deliberate-action client and does not need a polling gate.

## Release and acceptance

Follow the normal native release workflow in [setup](setup.md) after acceptance: reserve a new version, generate the signed archive and provenance, update appcast/version metadata, then run release consistency. Source changes are not an installed update. No install script should run while the user's app is open.

Required live checks before rollout is considered complete:

1. Verify all participating clients are integration builds and use the intended non-production test environment first.
2. Turn off while Mac/web views are open. After the control check, task/source/database requests stop; control requests remain.
3. Save a task, perform manual refresh and deliver an existing attention alarm in standby. Each remains functional without activating the switch.
4. Send signed test source events in standby. Verify durable storage and no Neon activity. Invalid signatures create no entries. Simulated storage failure must not return success.
5. Turn on. Verify local signal delivery, remote transition within the next 30-second check, catch-up pending/completion, source updates and fresh UI data.
6. Test concurrent clients, unavailable service, worker interruption and cutoff while the controller is asleep. Verify queued data is not deleted on failure.
7. Confirm provider/client compatibility with deferred `202` ingestion. Observe production usage over 24 hours and seven days only after authorized rollout.

Rollback: pause rollout and retain/export queued events. Do not remove configuration until pending events have been handled. Never delete the inbox to clear a stuck event.

## Local validation

```sh
npm test
npm run typecheck
npm run build:web
cd apps/macos && swift test --disable-sandbox
```

The App Switchr repository also provides a real local HTTP contract test accepting this checkout's absolute path. Its service process and credentials are temporary, and it never connects to Neon.

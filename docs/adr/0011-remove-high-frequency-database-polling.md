# Remove high-frequency database polling

Todo Trackr does not run scheduled database work every one or two minutes. Those schedules repeatedly woke Neon before its five-minute idle window could elapse and produced 64,800 avoidable invocations in a 30-day month.

Shortcut Automatic mode uses authenticated, idempotent webhooks for individual Story changes. This decision originally retained a 15-minute full reconciliation; [ADR 0012](./0012-budget-unattended-neon-compute.md) replaces that cadence with aligned six-hour repairs. Manual Sync remains available.

The native macOS app schedules Attention Alarm notifications locally. Web alarms create one delayed Trigger.dev run when an alarm is set. At the requested time, that run calls a narrowly authenticated Netlify endpoint, which atomically verifies the Task and sends Web Push. Rescheduling, clearing, completing, archiving, or deleting a Task cancels the stored run. Stale callbacks safely perform no work.

Regression tests reject one-minute and two-minute Netlify schedules. This decision supersedes ADR 0008.

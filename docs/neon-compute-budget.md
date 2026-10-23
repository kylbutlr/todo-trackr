# Neon compute budget

Todo Trackr is designed to let the production Neon compute return to Idle when Kyle is not actively using it. Neon currently documents that an idle compute can scale to zero after five minutes, so no recurring Todo Trackr database job should run every five minutes or faster. Check the current behavior in [Neon's scale-to-zero documentation](https://neon.com/docs/introduction/scale-to-zero) and the current allowance for the project's plan on [Neon pricing](https://neon.com/pricing).

## Unattended work

| Source | Behavior |
| --- | --- |
| Granola | Signed webhooks handle prompt discovery; repair runs at minute 17 every six hours |
| Shortcut | Signed webhooks handle prompt updates; repair runs at minute 17 every six hours |
| macOS | No Task API refresh while Todo Trackr and Mini Trackr are both hidden; visible Task reads back off to ten minutes when unchanged |
| Attention Alarms | One delayed Trigger.dev callback per active alarm, not a polling schedule |

Visible web and macOS Task surfaces begin at 30-second refreshes, then back off to one, two, and ten minutes after unchanged snapshots. Returning to a visible surface or resuming App Switchr triggers an immediate refresh. The ten-minute idle interval lets a compute with a five-minute scale-to-zero setting reach Idle between quiet reads.

The macOS app also offers a [per-Mac Shortcut sync interval](macos-shortcut-sync.md), defaulting to 60 minutes for new installations while a Task surface is visible. Previously saved intervals are preserved. Its countdown controls fresh source reconciliation, separately from the adaptive stored-task refresh. Off disables this additional polling, and 1- or 5-minute settings display a usage warning. Hidden/minimized surfaces and signed-out sessions make no scheduled sync requests.

At a 0.25 CU minimum and a five-minute wake window, four shared repair windows per day have a theoretical floor of about 2.5 CU-hours per 30 days. This is a planning model, not a bill guarantee. Job duration, user activity, webhook volume, other branches, and the project's actual compute settings can increase usage.

## Check current usage

The web Shortcut Board and Shortcut, Granola, and Codex connection screens now share the task view's quiet backoff: 30 seconds, one minute, two minutes, then ten minutes. Response-generation timestamps do not reset that backoff. Real source changes do. Focus, reconnect, visibility return, and Switchr activation request an immediate refresh. Hidden, offline, and standby screens do not make automatic reads. Manual actions keep their existing behavior.

New native installations default extra Shortcut reconciliation to 60 minutes. Existing explicitly saved intervals, including Off and short intervals, are preserved. To reduce work on an existing Mac, choose **60 minutes** or **Off** under **Next sync** if webhook freshness is sufficient. This native default change requires a signed release before it affects installed apps; local source changes do not update them.

1. Open the [Neon Console](https://console.neon.tech/), select the Todo Trackr project, then open Usage or Billing. Record the exact meter name, date range, amount used, and plan allowance. Do not infer the resource from the percentage alone.
2. Open the production branch's Compute or Monitoring view. Check whether the compute reaches `Idle` during periods when the web app is closed and both native Task windows are hidden.
3. Inspect the last 24 hours. Before this change, a five-minute wake source could bridge every scale-to-zero window. After deployment, unattended activity should cluster around `00:17`, `06:17`, `12:17`, and `18:17` UTC, plus real webhooks and alarms.
4. Compare the Neon chart with Netlify Function logs for `granola-scheduled`, `shortcut-scheduled`, webhook handlers, and the main API. A database spike without one of those events needs separate investigation.
5. Capture a second Usage snapshot after 24 hours, then again after seven days. Compare usage per day, not just the account's cumulative percentage.

The Neon Console labels can change. If the view does not expose Compute status, capture the available Usage and branch charts and keep the meter names in the report.

## Emergency controls

Set either Netlify Production Functions variable to `false`, then redeploy the Functions before relying on the change:

```text
TODO_TRACKER_GRANOLA_REPAIR_ENABLED=false
TODO_TRACKER_SHORTCUT_REPAIR_ENABLED=false
```

These switches stop only the scheduled handoff before it reads a secret or calls a repair endpoint. Signed webhooks and manual actions remain available. Restore a switch to `true` only after confirming the related repair is needed and the Usage chart still leaves sustained Idle periods.

No production environment value, deployment, or database setting should be changed without explicit approval.

## Optional App Switchr control

The [App Switchr integration](app-switchr.md) adds a shared standby gate before automatic client refreshes and hosted repair work. When configured, incoming source events are preserved in Blobs for catch-up without querying Neon at receipt. Explicit user actions and attention alarms remain active. Control-state requests and webhook storage still consume Netlify resources, so this is not a zero-usage guarantee. Production savings require the deployment, updated clients and the observation procedure above.

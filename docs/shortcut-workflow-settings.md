# Shortcut workflow states

Open **Connections → Shortcut → Workflow states to track** in [Todo Trackr](https://todotrackr.netlify.app/?view=connection:shortcut). The Mac app's **Next sync → Connection settings** link opens the same settings.

Check the unfinished workflow states that should create or reopen Tasks for Stories assigned to Kyle, then choose **Save workflow states**. Engineering Triage is available from the connected Shortcut workspace. Changes apply to the shared server rule and therefore affect the web and Mac Task queues.

- **Review:** Save, run Preview, inspect the proposed changes, then Apply changes.
- **Automatic:** Save, then Sync now for immediate reconciliation. Otherwise, the next applicable webhook or full reconciliation uses the saved rule.
- **Off:** You can save settings, but fetching and reconciliation wait until the Connection is enabled.

Saving settings does not create, complete, archive, or reopen Tasks by itself. Unchecking a tracked state archives its existing open Tasks on the next reconciliation, unless that state is an existing completion signal. Selecting an existing completion state makes it create/reopen instead. Completed Stories cannot be selected. Assignment, archived-source behavior, and personal Task metadata retain their existing rules.

The app fetches the available workflow states from Shortcut when settings open, when you return to the page, and when you choose **Refresh states**. Refresh preserves unsaved selections. Newly created states appear unchecked, renamed states use their current labels, and removed states remain visible in your selection so you can uncheck them deliberately. If loading fails, use **Retry refresh**.

When another device has saved a newer selection, a clean form adopts it. If you have unsaved edits, the app preserves your draft and blocks saving until you choose **Reload saved settings**, which discards the draft and loads the latest saved selection.

Every Preview and reconciliation fetches the current workflow catalog before observing Stories. It uses current state names and omits removed or completed IDs from tracked-state searches without rewriting the saved selection. Existing linked Stories are still checked individually, so Tasks can be archived or completed according to the rule. A renamed state also refreshes existing Task metadata. If the workflow catalog cannot be fetched, reconciliation stops rather than applying changes from stale state definitions.

Selections use immutable revisions in the existing `automation_rule_versions` table. A save retires the active revision and adds the next unused revision, preserving all other configuration and the proposed Responsibility v2 shadow. Preview approvals include the exact revision and selection. Reconciliation records the revision used and rolls back if a settings save made that preview stale. No new database migration is required.

Existing installations retain their six tracked states until explicitly changed. Engineering Triage is an opt-in selection, not an automatic rollout change. Todo Trackr does not write to Shortcut.

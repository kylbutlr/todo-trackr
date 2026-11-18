# Automation roadmap

Todo Trackr should become the canonical action queue for work, not a second copy of Slack, Shortcut, or Gmail.

## Product foundation

1. Add user-created Lists with Inbox as the default.
2. Add Smart Views for All, Today, Upcoming, Overdue, Completed, and Archived.
3. Add search, priority filtering, due-date filtering, and deterministic sorting.
4. Keep web and macOS behavior aligned through the same API contract.

Todo Trackr uses the ordered Priority scale Highest, High, Medium, Low, Lowest, and None for both manual and source-backed Tasks. Shortcut priority values map exactly to the corresponding Todo Trackr level, including an unset Shortcut priority mapping to None. Shortcut deadlines synchronize as date-only Task Due Dates and become overdue only after that local calendar day ends. Manual Tasks may continue to include a specific Due Time. Shortcut Size values S, M, L, and XL are preserved as read-only source metadata in Task Details. Size remains independent of Priority and is not initially available on manual Tasks.

The initial Account Timezone is `America/Los_Angeles`. Due Times, automation timestamps, and notification timestamps use that timezone consistently across web, macOS, and mobile devices. Date-only Due Dates retain their calendar date when a device changes timezone.

## Source foundation

Add source metadata only after the task workspace is dependable:

- source type: `manual`, `browser`, `shortcut`, `granola`, `slack`, or `gmail`
- stable external reference for idempotency
- source URL for returning to the original context
- observed and reconciled timestamps
- optional completion rule identifier

A source can create or reconcile a Task, but it does not own the Task record.

## Ingestion

Each connector should normalize an external event into the same candidate-action contract. A rule then decides whether to ignore it, attach it to an existing task, or create a new task in Inbox.

Examples:

- a Slack message that directly asks Kyle for an answer
- a Shortcut story assigned to Kyle and moved into an actionable state
- a Gmail message that requires a reply rather than merely being unread

Every ingestion path must use an idempotency key derived from the source and external reference so retries cannot create duplicates.

## Initial Shortcut trial

The first Automation Rule establishes a Responsibility when Kyle is a Shortcut story owner. It creates or reopens one Task for that rule and story in Triage, Triage In Progress, Ready for LOE, Ready for Development, In Progress, or Pending Eng. It completes the Task in Pending Ops, Pending Client, Agentic QA, QA In Progress, CSM Review, QA in Staging, Production Approved, Deployed, or Completed. A later transition back to an active state reopens the same Task. Unassignment archives it, and reassignment can reopen it without duplication. This is a narrow trial rule, not the permanent definition of Kyle's responsibilities.

Shortcut Responsibility Rule v2 is a proposed shadow rule. It aggregates direct assignment, requester status, and explicit description or comment requests into one Task per Story. Assignment is primary, requester-only work is a muted Background Task, and explicit requests are Heads Ups. Heads Ups are user-completable and a later Kyle comment is treated as a source Completion Signal. Agentic QA and QA In Progress preserve an existing open Responsibility rather than completing it. Rule v2 records observations without changing Tasks until the shadow comparison is explicitly approved for activation.

Completion states take precedence over unassignment. If a story enters a configured completion state and Kyle is unassigned in the same observation, its Task becomes Completed because a Completion Signal exists. Unassignment archives the Task only when the story is not in a configured completion state. Both outcomes remove the Task from active views, but only Completed Tasks appear in completion history; Archived Tasks represent a lapsed Responsibility and may reopen on reassignment.

An Archived Task is not retroactively completed if its unassigned Shortcut story later reaches a completion state under someone else's responsibility. It remains Archived until the Responsibility returns. If Kyle is reassigned while the story is in an active state, Todo Trackr reopens the same Task, refreshes every Shortcut-owned field, and preserves its user-owned List and Notes.

In Automatic mode, authenticated Shortcut webhooks reconcile changed Story references as events arrive. A scheduled full reconciliation also evaluates current Shortcut state so missed webhook events, downtime, changed rules, and temporary failures are eventually repaired.

Full Shortcut reconciliation runs every six hours. A manual Sync Shortcut Now action triggers the full reconciliation immediately, and the existing status area reports webhook activity plus repair progress or failure.

Connection Health uses a color-coded status indicator: green for Healthy, a blue pulse for Syncing, amber for Degraded after one or two transient failures, red for Failed after three consecutive transient failures or any authentication or configuration failure, and gray for Paused. Authentication and configuration failures notify immediately. Transient failures notify when the third consecutive run fails, and one recovery notification is sent when the Connection returns to Healthy.

The Shortcut Connection offers Off, Review, and Automatic modes. Off stops Shortcut processing without changing or hiding existing Tasks. Review fetches only when requested and requires approval before applying changes. Automatic accepts authenticated webhook events and runs a full reconciliation immediately when enabled.

Shortcut credentials are server-managed for the initial single-user version. The API token and internal synchronization secret live only in Netlify environment variables and are available only to server-side functions. Web and macOS clients receive Connection status and reconciliation results but never receive reusable Shortcut credentials. Todo Trackr does not initially provide a UI for entering or revealing these secrets.

Connection settings display the active Shortcut state mapping but do not initially allow editing it. Automation Rules are versioned server-side, and every Automation Activity records the Rule Version that produced the decision. A preview-capable editor can be added when Todo Trackr supports multiple rules and responsibilities.

Every Rule Version change requires a full reconciliation preview before activation. The existing version remains active while the proposed version reports which Tasks it would create, update, complete, reopen, or archive. Approval activates the proposed version and applies its reconciliation; unapproved versions cannot affect Tasks.

Shortcut-created Tasks default to Inbox and remain ordinary Tasks that appear in All while incomplete and in other applicable Smart Views. Each carries a visible Shortcut Source badge, can be filtered by Source, and also appears in a dedicated Shortcut Smart View under a Sources section in the sidebar.

All contains every open, non-archived Task across Lists and Sources. Completed and Archived Tasks are excluded from All and normal searches by default, with separate historical Smart Views for each. Archived shows when and why a Task was archived, and search can explicitly include archived records when needed.

Initial activation runs in preview mode and reports the Tasks the rule would create, complete, reopen, or archive without writing them. Kyle approves the one-time backfill before the connector begins applying future transitions automatically.

Reconciliation synchronizes the Shortcut ticket ID and link, ticket name, Source badge, exact five-level priority, Size, due date, current responsibility, workflow state, Source excerpt, and automated lifecycle. List and Notes remain user-controlled, with the Source excerpt kept separate so source refreshes cannot overwrite Kyle's writing.

Source excerpts are derived deterministically from Shortcut descriptions without sending ticket content to another service. Markdown controls, boilerplate section labels, template instructions, ticket-reference lists, and links are removed before Todo Trackr keeps the first one or two meaningful sentences. When no useful source text remains, the preview omits the excerpt instead of repeating the Task title. A content fingerprint prevents regeneration unless the Shortcut ticket name or description changes. The description provider remains replaceable so an approved AI service can be introduced later without changing Task ownership boundaries.

Shortcut Tasks are read-only lifecycle projections. Todo Trackr never writes to Shortcut and disables manual complete, reopen, archive, and delete controls for these Tasks. Shortcut assignment and workflow state exclusively determine their lifecycle, while List and Notes remain editable in Todo Trackr.

When Shortcut confirms that a story was archived or deleted, Todo Trackr archives its Task and identifies the Source as unavailable. It never treats source disappearance as completion. A temporary Shortcut request failure leaves the Task unchanged, preserves its last known source data, and marks the Connection stale for later reconciliation.

Each Shortcut Task includes a compact, read-only Automation Activity timeline showing what changed, why, when, and which Shortcut observation caused it. Connection settings separately show Sync History with the trigger, outcome, created, updated, completed, reopened, and archived counts, plus any errors. Task explanations and run diagnostics remain separate so source decisions are understandable without crowding the main task list.

Automation Activity is retained for the lifetime of its Task. Detailed Sync History is retained for 90 days, while each Connection keeps its latest successful and failed sync status indefinitely.

Todo Trackr notifies Kyle when automation creates, reopens, completes, or archives Tasks, and when synchronization fails. A single affected Task produces a notification naming that Task; multiple changes from one reconciliation are grouped into one summary. Routine synchronized metadata changes do not produce notifications and remain visible in Automation Activity. The approved initial backfill produces one summary rather than one notification per imported Task.

Standard Web Push is the primary background notification channel. The Todo Trackr web app can register per-device subscriptions for its installed iPhone Home Screen app, Mac Dock web app, and supported browsers without requiring a paid Apple Developer membership. The native macOS app may also produce local notifications for changes it observes while running; native APNs delivery is outside the initial scope.

## Agentic completion

Completion should require source-specific evidence:

- Slack: Kyle posts the required reply in the relevant conversation
- Shortcut: the referenced story reaches the configured completed state
- Gmail: Kyle sends a reply in the referenced thread

The reconciler should record the completion signal before completing the Task. Deterministic rules may apply transitions automatically, while ambiguous evidence should request review rather than silently closing work.

## Browser Quick Capture

The initial browser extension is a focused Quick Capture companion. Kyle selects text on the active page and invokes a configurable keyboard shortcut. The extension creates a manual-lifecycle Task in Inbox using the selected text as its title, retains the page URL as context, and confirms success or failure. If no text is selected, it uses the page title. The extension requests temporary active-tab access only when explicitly invoked and does not continuously read browsing activity.

Hosting the complete Todo Trackr workspace inside the extension is a later product expansion. The first version keeps task planning and management in the web, macOS, and mobile experiences while making capture nearly instantaneous.

## Delivery phases

### Phase 1: Product workspace

Lists, Smart Views, search, due-date filters, priority filters, sorting, and clear due-state presentation.

### Phase 2: Automation-ready records

Sources, external references, idempotency, source links, activity history, and completion-signal records.

### Phase 3: Read-only connectors

Ingest candidate actions from one source at a time. Start with Shortcut because its lifecycle is more explicit than conversational Slack or Gmail intent.

### Phase 4: Reconciliation

Observe external completion signals and suggest task completion by default. The initial Shortcut trial may create, reopen, complete, and archive Tasks automatically because its assignment and workflow-state criteria are deterministic. Measure false positives before allowing automatic transitions for interpretive rules.

### Phase 5: Controlled autonomy

Enable automatic completion only for rules with deterministic evidence. Preserve an audit trail and make every automated transition reversible.

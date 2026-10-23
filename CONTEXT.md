# Work Action Tracking

Todo Trackr turns personal commitments from manual entry and connected work systems into one manageable action queue.

## Language

**Task**:
A concrete action the owner intends to complete. A task has one lifecycle regardless of whether it was entered manually or created from an external source.
_Avoid_: Todo item, reminder, source item

**Quick Capture**:
A user-initiated Task creation from the context currently in view, without requiring an Automation Rule. A browser selection can supply the Task title and its page can remain linked as context.
_Avoid_: Automated ingestion, synchronization

**Responsibility**:
A source-backed obligation the owner is expected to personally advance or resolve. It can be established by assignment, workflow state, participation, a requested action, or another explicit rule.
_Avoid_: Ownership, assignment, involvement

**Responsibility Reason**:
A source fact that independently establishes a Responsibility. One Task may collect several Responsibility Reasons and remains active while any one of them still applies.
_Avoid_: Duplicate Task, matching condition

**Assigned Responsibility**:
A Responsibility established because the owner is directly assigned to advance a source object. Its lifecycle follows deterministic source state rather than manual completion in Todo Trackr.
_Avoid_: Ownership, Heads Up

**Requester Responsibility**:
A lower-salience Responsibility established because the owner requested a source object without being its active assignee. It remains visible as background awareness rather than primary action.
_Avoid_: Assigned Responsibility, follower

**Heads Up**:
A user-completable Responsibility created when source text explicitly asks the owner to act or respond. A Heads Up may complete from the owner's response in the Source or from the owner marking its Task complete in Todo Trackr.
_Avoid_: Mention, Assigned Responsibility, notification

**Background Task**:
An open Task deliberately shown with reduced visual salience because it is useful awareness rather than primary action.
_Avoid_: Archived Task, hidden Task, low Priority

**Archived Task**:
An inactive task retained for history and reconciliation but excluded from active views. An automated task is archived when its responsibility no longer applies and may reopen if that responsibility returns.
_Avoid_: Deleted task, completed task, withdrawn task

**List**:
A user-managed collection that gives a task durable organizational context. Every task belongs to exactly one list, with Inbox as the default.
_Avoid_: Project, folder, smart list

**Inbox**:
The default list for tasks that have not been deliberately organized.
_Avoid_: Unsorted, default list

**Smart View**:
A derived selection of tasks such as All, Today, Upcoming, Overdue, Completed, or Archived. All contains every open, non-archived task across Lists and Sources; completed and archived tasks remain in their separate historical views. A smart view does not own or duplicate tasks.
_Avoid_: List, saved search

**Shortcut Board**:
A read-only workspace of active Shortcut Stories that match the owner's selected Personal Scope. Shortcut Board entries remain Source objects and do not become Tasks merely because they are visible.
_Avoid_: Shortcut List, imported Tasks, Delivery Board

**Personal Scope**:
The Shortcut Board relationship used to select Stories: the owner is Owner, the owner is Requester, the owner is both Owner and Requester, or the owner is either Owner or Requester.
_Avoid_: Responsibility, assignment filter, requester filter

**Priority**:
An explicit importance signal independent of when a task is due. Its ordered levels are Highest, High, Medium, Low, and Lowest; None means no priority has been assigned.
_Avoid_: Urgency, rank

**Size**:
A source-provided relative estimate of effort using S, M, L, or XL. Size is independent of Priority and is not initially assigned to manual tasks.
_Avoid_: Priority, duration, hours

**Due Date**:
The calendar day by whose end a task should be complete. A task without a Due Time becomes overdue only after its Due Date ends.
_Avoid_: Due Time, schedule, deadline window

**Due Time**:
An optional time on a Due Date that makes a task overdue after that specific moment. Shortcut deadlines do not initially provide a Due Time.
_Avoid_: Due Date, duration

**Attention Alarm**:
A user-set date and time that marks a Task for deliberate follow-up. It is independent of Priority and Due Date, and may be attached to a manually entered or Source-managed Task.
_Avoid_: Due Time, deadline, notification

**Needs Attention**:
The persistent state entered when an Attention Alarm reaches its scheduled time. Notification delivery announces the state once, but the Task remains visually emphasized until the owner explicitly clears the Attention Alarm.
_Avoid_: Overdue, Highest Priority, Needs You

**Clear Alarm**:
The explicit acknowledgement that ends a Task's Needs Attention state and removes its scheduled importance. Completing, archiving, or deleting a Task also prevents further alarm delivery.
_Avoid_: Dismiss notification, complete Task, snooze

**Account Timezone**:
The single timezone used to interpret Due Times and automation timestamps consistently across devices. Date-only Due Dates do not shift with device location.
_Avoid_: Device timezone, source timezone

**Source**:
The system or manual action from which a task originated, such as Slack, Shortcut, Gmail, or Todo Trackr.
_Avoid_: Integration, channel

**Unavailable Source**:
A source object confirmed to have been archived, deleted, or otherwise made permanently inaccessible. Its Task is archived rather than completed because disappearance is not a completion signal.
_Avoid_: Completed source, sync failure, deleted Task

**Connection**:
A configured link between Todo Trackr and a Source. Its control mode is Off, Review, or Automatic. Changing modes never hides or rewrites existing Tasks by itself.
_Avoid_: Source, account, integration

**Codex Work Session**:
A Codex conversation attached to a Task so Todo Trackr can show its latest progress, summary, and handoff links while the conversation itself remains in Codex. A Work Session does not change the Task's Source.
_Avoid_: Codex Task, copied chat, Task Source

**Needs You**:
A Codex Work Session state indicating that Codex is waiting for the owner to answer, approve, or review something. It is an attention signal, not a Task lifecycle state.
_Avoid_: Blocked Task, overdue, failed

**Review Mode**:
A Connection mode that fetches only on request and requires explicit approval before applying proposed Task changes.
_Avoid_: Paused, automatic preview

**Automatic Mode**:
A Connection mode that applies authenticated source events promptly and uses scheduled reconciliation to repair missed changes.
_Avoid_: Unreviewed rule change, source write access

**Connection Health**:
The current operational condition of a Connection: Healthy, Syncing, Degraded, Failed, or Paused. Paused health corresponds to Off mode.
_Avoid_: Task status, source state

**External Reference**:
A stable identifier for a source object that allows later reconciliation. Different responsibilities may share an external reference.
_Avoid_: URL, source item

**Completion Criterion**:
The source-specific condition that ends a responsibility. It is independent of whether the source object itself is globally finished.
_Avoid_: Final status, done state

**Completion Signal**:
Verified evidence from a source that a task's completion criterion has been satisfied.
_Avoid_: Activity, update

**Automation Activity**:
An immutable explanation of an automated Task decision, including what changed, why it changed, when it happened, and which Source observation caused it.
_Avoid_: Sync log, task notes

**Sync History**:
A record of a Connection reconciliation run, including its trigger, outcome, affected Task counts, and errors.
_Avoid_: Automation Activity, task history

**Source Excerpt**:
A brief cleaned extract of the request represented by a source object. It follows source content and remains separate from the owner's notes.
_Avoid_: Notes, AI summary, full source description

**Automation Rule**:
A declared rule that creates, updates, completes, reopens, or archives tasks from source observations.
_Avoid_: Agent, workflow

**Rule Version**:
An immutable revision of an Automation Rule that identifies the exact criteria used for an automated decision.
_Avoid_: Current rule, connection version

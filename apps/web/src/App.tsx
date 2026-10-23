import { InstallationContext, legacyInstallation, useInstallation, type Installation } from "./installation";
import { automaticWorkAllowed, useWorkSwitch } from "./workSwitch.js";
import { useAdaptiveRefresh } from './useAdaptiveRefresh.js';
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { api, APIError, onSessionExpired } from "./api";
import { ShortcutWorkflowSettingsView } from "./ShortcutWorkflowSettingsView";
import { ShortcutBoardView } from "./ShortcutBoardView";
import { ShortcutStateDueLabel, shortcutDueDateLabel } from "./ShortcutStateDueLabel";
import { SystemHealthView } from "./SystemHealthView";
import {
  COMPLETION_EXIT_MS,
  COMPLETION_HOLD_MS,
  preservePendingCompletions,
  type CompletionFeedbackPhase,
} from "./completionFeedback";
import { formatReviewCount, shortcutPendingReviewCount } from "./connectionReview";
import { isBackgroundReleaseTask } from "./taskClassification";
import { nextPollCountdown } from "./pollCountdown";
import { initialConnectionView } from "./initialView";
import { draftFromTask, reconcileTaskDraft } from "./taskDraft";
import { dueState, queryTasks, taskSections, tasksForView, type DueFilter, type SmartView, type SortMode } from "./taskViews";
import { disableWebPush, enableWebPush, webPushState, type WebPushState } from "./webPush";
import {
  MOBILE_WORKSPACE_MEDIA_QUERY,
  readWorkspaceLayout,
  workspaceLayoutForViewport,
  writeWorkspaceLayout,
  type WorkspaceLayout,
} from "./workspaceLayout";
import { nextTaskPollIntervalMs, shouldPollWorkspace, WORKSPACE_POLL_INTERVAL_MS } from "./workspaceRefreshPolicy";
import type { CodexDiagnostics, CodexSession, CodexSessionStatus, GranolaConnection, GranolaDiagnostics, ShortcutAutomationActivity, ShortcutConnection, ShortcutConnectionControlMode, ShortcutDiagnostics, ShortcutPreview, ShortcutPreviewAction, ShortcutRuleV2Shadow, ShortcutSyncRun, SystemHealth, Task, TaskList, TaskPriority, UpdateTaskInput } from "./types";

type AuthState = "checking" | "signed-out" | "signed-in";
type SyncState = "syncing" | "synced" | "error";
type ConnectionView = `connection:${"shortcut" | "granola" | "codex" | "system"}`;
type ViewKey = SmartView | `list:${string}` | `source:${"shortcut" | "granola" | "slack"}` | ConnectionView;
type WorkspaceMode = "tasks" | "shortcut";

const WORKSPACE_MODE_STORAGE_KEY = "todo-trackr.workspace-mode";

function readWorkspaceMode(): WorkspaceMode {
  return window.localStorage.getItem(WORKSPACE_MODE_STORAGE_KEY) === "shortcut" ? "shortcut" : "tasks";
}

function isConnectionView(view: ViewKey): view is ConnectionView {
  return view.startsWith("connection:");
}

function Icon({ name }: { name: "alarm" | "alert" | "archive" | "back" | "calendar" | "check" | "clock" | "close" | "code" | "columns" | "folder" | "inbox" | "list" | "logout" | "plus" | "refresh" | "shortcut" | "star" | "trash" }) {
  const paths = {
    alarm: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4M5 3 2 6M19 3l3 3" /></>,
    alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.7 2.5 17.2A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.8L13.7 3.7a2 2 0 0 0-3.4 0Z" /></>,
    archive: <><path d="M4 5h16v4H4zM6 9v11h12V9" /><path d="M10 13h4" /></>,
    back: <path d="m15 18-6-6 6-6" />,
    calendar: <path d="M5 4h14v16H5zM8 2v4M16 2v4M5 9h14" />,
    check: <path d="m5 12 4 4L19 6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    code: <><path d="m8 9-3 3 3 3M16 9l3 3-3 3" /><path d="m14 5-4 14" /></>,
    columns: <><path d="M4 4h16v16H4z" /><path d="M12 4v16" /></>,
    folder: <path d="M3 6h7l2 2h9v11H3z" />,
    inbox: <path d="M4 4h16v13H4zM4 13h4l2 3h4l2-3h4" />,
    list: <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />,
    logout: <path d="M10 17l5-5-5-5M15 12H3M15 4h5v16h-5" />,
    plus: <path d="M12 5v14M5 12h14" />,
    refresh: <path d="M20 6v6h-6M4 18v-6h6M6.5 8.5A7 7 0 0 1 18.8 7L20 12M4 12l1.2 5A7 7 0 0 0 17.5 15.5" />,
    shortcut: <><path d="M9 7H6a4 4 0 0 0 0 8h3M15 7h3a4 4 0 0 1 0 8h-3M8 11h8v2H8z" /></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
    trash: <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" />,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);

    try {
      await api.login(password);
      onSuccess();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <div className="app-mark"><Icon name="check" /></div>
        <h1>Todo Trackr</h1>
        <p className="login-copy">Enter this server’s password to access your tasks.</p>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          autoComplete="current-password"
          autoFocus
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="primary-button" disabled={!password || submitting} type="submit">
          {submitting ? "Signing in…" : "Open Todo Trackr"}
        </button>
      </form>
    </main>
  );
}

function NewTask({ onCreate }: { onCreate: (title: string) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      await onCreate(trimmed);
      setTitle("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="new-task" onSubmit={submit}>
      <span className="new-task-icon"><Icon name="plus" /></span>
      <input
        aria-label="New task title"
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Add a task"
        value={title}
      />
      <button disabled={!title.trim() || submitting} type="submit">Add</button>
    </form>
  );
}

const codexStatusLabels: Record<CodexSessionStatus, string> = {
  linked: "Linked",
  queued: "Queued",
  working: "In progress",
  waiting_for_you: "Needs you",
  ready_for_review: "Ready for review",
  failed: "Blocked",
  finished: "Finished",
};

function TaskRow({ task, completionFeedbackPhase, selected, listName, recent = false, onSelect, onToggle, onToggleStar }: {
  task: Task;
  completionFeedbackPhase?: CompletionFeedbackPhase;
  selected: boolean;
  listName?: string;
  recent?: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onToggleStar: () => void;
}) {
  const installation = useInstallation();
  const sourceManaged = task.source === "shortcut";
  const sourceLabel = task.source === "shortcut"
    ? "Shortcut"
    : task.source === "granola"
      ? "Granola"
      : task.source === "slack"
        ? "Slack"
        : task.source === "browser" ? "Browser" : null;
  const sourceDisplayLabel = task.source === "shortcut" ? task.sourceDetails?.epicName : sourceLabel;
  const taskDueState = dueState(task);
  const visuallyCompleted = task.status === "completed" || completionFeedbackPhase !== undefined;
  const backgroundRelease = isBackgroundReleaseTask(task);
  const sourceReference = task.sourceDetails?.externalReference
    ? `SC-${task.sourceDetails.externalReference}`
    : task.title;
  const shortcutReference = task.source === "shortcut" ? task.sourceDetails?.externalReference : undefined;
  const dueLabel = task.dueAt
    ? taskDueState === "today"
      ? "Today"
      : taskDueState === "overdue"
        ? `Overdue · ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(task.dueAt))}`
        : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(task.dueAt))
    : "No due date";
  const createdLabel = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(task.createdAt));
  const shortcutDueLabel = shortcutDueDateLabel(task.dueAt ? new Date(task.dueAt) : null);

  return (
    <div className={`task-row ${selected ? "is-selected" : ""} ${backgroundRelease ? "is-background-release" : ""} ${task.needsAttention ? "needs-attention" : ""} ${task.alarmAt && !task.needsAttention ? "has-alarm" : ""} ${shortcutReference ? "has-source-reference" : ""} ${completionFeedbackPhase ? `is-${completionFeedbackPhase}` : ""}`}>
      <div className="task-row-leading">
        {sourceManaged ? (
          task.sourceUrl ? (
            <a
              aria-label={`Open ${sourceReference} in Shortcut`}
              className="task-source-indicator"
              href={task.sourceUrl}
              rel="noreferrer"
              target="_blank"
              title={`Open ${sourceReference} in Shortcut`}
            >
              <Icon name="shortcut" />
            </a>
          ) : (
            <span
              aria-label={`${task.title} completion follows Shortcut`}
              className="task-source-indicator"
              role="img"
              title="Completion follows Shortcut"
            >
              <Icon name="shortcut" />
            </span>
          )
        ) : (
          <button
            aria-label={task.status === "archived" ? `${task.title} is archived` : task.status === "completed" ? `Mark ${task.title} open` : `Complete ${task.title}`}
            className={`task-check ${visuallyCompleted ? "is-complete" : ""}`}
            disabled={task.status === "archived" || completionFeedbackPhase !== undefined}
            onClick={onToggle}
            type="button"
          >
            {visuallyCompleted ? <Icon name="check" /> : null}
          </button>
        )}
        {shortcutReference ? <span className="task-source-reference">{shortcutReference}</span> : null}
      </div>
      <button className="task-summary" onClick={onSelect} type="button">
        <span className={`task-title ${visuallyCompleted ? "completed-title" : ""}`}>
          {task.title}
        </span>
      </button>
      <div className="task-row-actions">
        <button
          aria-label={task.isStarred ? `Remove ${task.title} from Starred` : `Add ${task.title} to Starred`}
          aria-pressed={task.isStarred}
          className={`task-star ${task.isStarred ? "is-starred" : ""}`}
          onClick={onToggleStar}
          title={task.isStarred ? "Remove from Starred" : "Add to Starred"}
          type="button"
        >
          <Icon name="star" />
        </button>
      </div>
      <div className="task-meta">
        {sourceLabel ? (
          <span
            aria-label={task.source === "shortcut" ? `Shortcut${sourceDisplayLabel ? ` Epic ${sourceDisplayLabel}` : ""}` : sourceLabel}
            className={`source-badge ${sourceDisplayLabel ? "" : "is-icon-only"}`}
            title={task.source === "shortcut" ? `Shortcut${sourceDisplayLabel ? ` · ${sourceDisplayLabel}` : ""}` : sourceLabel}
          >
            <Icon name="shortcut" />
            {sourceDisplayLabel}
          </span>
        ) : null}
        {task.needsAttention ? <span className="alarm-label"><Icon name="alarm" />Needs attention</span> : null}
        {task.alarmAt && !task.needsAttention && !task.alarmClearedAt ? (
          <span className="alarm-scheduled" title="Attention Alarm scheduled">
            <Icon name="alarm" />
            {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(task.alarmAt))}
          </span>
        ) : null}
        <span className={`priority-label priority-${task.priority}`}>
          <span className="priority-dot" />
          {task.priority === "none" ? "No priority" : task.priority}
        </span>
        {recent ? <span>{listName}</span> : null}
        {recent ? <span className="due-label is-created">{createdLabel}</span> : null}
        {task.source === "shortcut" ? (
          <ShortcutStateDueLabel
            workflowStateName={task.sourceDetails?.workflowStateName}
            dueDateLabel={shortcutDueLabel}
            dueTone={taskDueState === "overdue" || taskDueState === "today" ? taskDueState : undefined}
          />
        ) : !recent ? <span className={`due-label is-${taskDueState}`}>{dueLabel}</span> : null}
      </div>
    </div>
  );
}

function TaskDetail({ task, lists, compact = false, onSave, onDelete, onClose, onToggleStar }: {
  task: Task;
  lists: TaskList[];
  compact?: boolean;
  onSave: (input: UpdateTaskInput) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
  onToggleStar: () => void;
}) {
  const installation = useInstallation();
  const sourceManaged = task.source === "shortcut";
  const sourceLabel = task.source === "shortcut"
    ? "Shortcut"
    : task.source === "granola"
      ? "Granola"
      : task.source === "slack"
        ? "Slack"
        : task.source === "browser" ? "Browser" : null;
  const [draft, setDraft] = useState(() => draftFromTask(task));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [activity, setActivity] = useState<ShortcutAutomationActivity[]>([]);
  const [codexSessions, setCodexSessions] = useState<CodexSession[]>([]);
  const [codexReference, setCodexReference] = useState("");
  const [codexLoading, setCodexLoading] = useState(true);
  const [codexSaving, setCodexSaving] = useState(false);
  const [codexError, setCodexError] = useState<string>();
  const { title, notes, priority, dueAt, alarmAt, listId } = draft;
  const addedAtLabel = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(task.createdAt));

  useEffect(() => {
    setDraft((current) => reconcileTaskDraft(current, task));
  }, [task]);

  useEffect(() => {
    if (!sourceManaged) {
      setActivity([]);
      return;
    }
    void api.taskActivity(task.id).then(setActivity).catch(() => setActivity([]));
  }, [task.id, sourceManaged]);

  useEffect(() => {
    if (!installation.integrations.codex) { setCodexLoading(false); return; }
    let cancelled = false;
    setCodexLoading(true);
    setCodexError(undefined);
    void api.taskCodexSessions(task.id)
      .then((sessions) => {
        if (!cancelled) setCodexSessions(sessions);
      })
      .catch((caught) => {
        if (!cancelled) setCodexError(caught instanceof Error ? caught.message : "Unable to load Codex work sessions.");
      })
      .finally(() => {
        if (!cancelled) setCodexLoading(false);
      });
    return () => { cancelled = true; };
  }, [task.id, installation.integrations.codex]);

  async function attachCodex() {
    const reference = codexReference.trim();
    if (!reference) return;
    setCodexSaving(true);
    setCodexError(undefined);
    try {
      const session = await api.attachCodexSession(task.id, reference);
      setCodexSessions((current) => [session, ...current.filter((item) => item.id !== session.id)]);
      setCodexReference("");
    } catch (caught) {
      setCodexError(caught instanceof Error ? caught.message : "Unable to attach the Codex conversation.");
    } finally {
      setCodexSaving(false);
    }
  }

  async function detachCodex(id: string) {
    setCodexSaving(true);
    setCodexError(undefined);
    try {
      await api.detachCodexSession(id);
      setCodexSessions((current) => current.filter((item) => item.id !== id));
    } catch (caught) {
      setCodexError(caught instanceof Error ? caught.message : "Unable to detach the Codex conversation.");
    } finally {
      setCodexSaving(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      await onSave({
        ...(sourceManaged ? {} : { title: title.trim() }),
        notes,
        ...(sourceManaged ? {} : {
          priority,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        }),
        alarmAt: alarmAt ? new Date(alarmAt).toISOString() : null,
        listId,
      });
      setDraft((current) => ({ ...current, dirty: false }));
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Unable to save this Task.");
    } finally {
      setSaving(false);
    }
  }

  async function clearAlarm() {
    setSaving(true);
    setSaveError(undefined);
    try {
      await onSave({ clearAlarm: true });
      setDraft((current) => ({ ...current, dirty: false, alarmAt: "" }));
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Unable to clear this alarm.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="detail-panel" onSubmit={submit}>
      <div className="detail-heading">
        {compact ? (
          <button className="compact-detail-back" onClick={onClose} type="button">
            <Icon name="back" />
            <span>Back to tasks</span>
          </button>
        ) : <p className="eyebrow">Task details</p>}
        <div className="detail-actions">
          <button
            aria-label={task.isStarred ? "Remove from Starred" : "Add to Starred"}
            aria-pressed={task.isStarred}
            className={`icon-button detail-star ${task.isStarred ? "is-starred" : ""}`}
            onClick={onToggleStar}
            title={task.isStarred ? "Remove from Starred" : "Add to Starred"}
            type="button"
          ><Icon name="star" /></button>
          {!compact ? <button aria-label="Close task details" className="icon-button detail-close" onClick={onClose} type="button"><Icon name="close" /></button> : null}
          {!sourceManaged ? <button aria-label="Delete task" className="icon-button danger" onClick={onDelete} type="button"><Icon name="trash" /></button> : null}
        </div>
      </div>
      <label htmlFor="task-title">Title</label>
      <input disabled={sourceManaged} id="task-title" onChange={(event) => setDraft((current) => ({ ...current, dirty: true, title: event.target.value }))} value={title} />

      <label htmlFor="task-notes">Notes</label>
      <textarea id="task-notes" onChange={(event) => setDraft((current) => ({ ...current, dirty: true, notes: event.target.value }))} placeholder="Add context or next steps" rows={8} value={notes} />

      <div className="task-added-field">
        <label>Added</label>
        <time dateTime={task.createdAt}>{addedAtLabel}</time>
      </div>

      {task.sourceUrl ? (
        <div className="source-link-field">
          <label>Source</label>
          <a href={task.sourceUrl} rel="noreferrer" target="_blank">
            {task.source === "shortcut" && task.sourceDetails
              ? `Open SC-${task.sourceDetails.externalReference}`
              : `Open ${task.source === "browser" ? "captured page" : task.source === "slack" ? "Slack source" : sourceLabel ?? task.source}`}
          </a>
        </div>
      ) : sourceLabel ? (
        <div className="source-link-field">
          <label>Source</label>
          <p>Captured from {sourceLabel}</p>
        </div>
      ) : null}

      {task.sourceDetails?.summary ? (
        <div className="source-detail-field">
          <label>Source excerpt</label>
          <p>{task.sourceDetails.summary}</p>
        </div>
      ) : null}

      {task.source === "shortcut" || task.sourceDetails ? (
        <div className="source-facts">
          {task.source === "shortcut" ? (
            <ShortcutStateDueLabel
              workflowStateName={task.sourceDetails?.workflowStateName}
              dueDateLabel={shortcutDueDateLabel(task.dueAt ? new Date(task.dueAt) : null)}
            />
          ) : task.sourceDetails?.workflowStateName ? <span>{task.sourceDetails.workflowStateName}</span> : null}
          {task.sourceDetails?.size ? <span>Size {task.sourceDetails.size}</span> : null}
          {sourceLabel ? <span>{task.source === "shortcut" ? "Managed by Shortcut" : `Captured from ${sourceLabel}`}</span> : null}
        </div>
      ) : null}

      {sourceManaged && activity.length > 0 ? (
        <details className="task-activity">
          <summary>Automation activity</summary>
          <div>
            {activity.map((item) => (
              <article key={item.id}>
                <span className={`history-status is-${item.action}`}>{item.action}</span>
                <p>{item.reason}</p>
                <time dateTime={item.createdAt}>{formatConnectionTime(item.createdAt)}</time>
              </article>
            ))}
          </div>
        </details>
      ) : null}

      {installation.integrations.codex ? <section className="codex-task-sessions">
        <div className="codex-task-heading">
          <div>
            <label>Codex work session</label>
            <p>Keep the conversation in Codex while Todo Trackr shows its latest state.</p>
          </div>
          <span className="codex-mark"><Icon name="code" /></span>
        </div>
        {codexLoading ? <p className="codex-empty">Loading work sessions…</p> : null}
        {!codexLoading && codexSessions.length === 0 ? <p className="codex-empty">No Codex conversation is attached yet.</p> : null}
        {codexSessions.map((session) => (
          <article className="codex-session-card" key={session.id}>
            <div className="codex-session-title">
              <span className={`history-status is-${session.status}`}>{codexStatusLabels[session.status]}</span>
              <strong>{session.title ?? "Codex conversation"}</strong>
            </div>
            {session.latestSummary ? <p>{session.latestSummary}</p> : <p className="codex-empty">Waiting for the first progress update.</p>}
            <div className="codex-session-meta">
              {session.branchName ? <span>{session.branchName}</span> : null}
              <time dateTime={session.lastSeenAt}>Updated {formatConnectionTime(session.lastSeenAt)}</time>
            </div>
            <div className="codex-session-actions">
              {session.threadUrl ? <a className="secondary-button" href={session.threadUrl} rel="noreferrer" target="_blank">Open in Codex</a> : null}
              {session.prUrl ? <a className="secondary-button" href={session.prUrl} rel="noreferrer" target="_blank">Open PR</a> : null}
              <button className="text-button" disabled={codexSaving} onClick={() => void detachCodex(session.id)} type="button">Detach</button>
            </div>
          </article>
        ))}
        <div className="codex-attach-row">
          <input
            aria-label="Codex conversation URL or thread ID"
            onChange={(event) => setCodexReference(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void attachCodex();
              }
            }}
            placeholder="Paste a Codex conversation URL or thread ID"
            value={codexReference}
          />
          <button className="secondary-button" disabled={!codexReference.trim() || codexSaving} onClick={() => void attachCodex()} type="button">
            {codexSaving ? "Attaching…" : "Attach"}
          </button>
        </div>
        {codexError ? <p className="detail-conflict" role="alert">{codexError}</p> : null}
      </section> : null}

      <div className="detail-grid">
        <div>
          <label htmlFor="task-list">List</label>
          <select id="task-list" onChange={(event) => setDraft((current) => ({ ...current, dirty: true, listId: event.target.value }))} value={listId}>
            {lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="task-priority">Priority</label>
          <select disabled={sourceManaged} id="task-priority" onChange={(event) => setDraft((current) => ({ ...current, dirty: true, priority: event.target.value as TaskPriority }))} value={priority}>
            <option value="none">None</option>
            <option value="lowest">Lowest</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="highest">Highest</option>
          </select>
        </div>
        <div>
          <label htmlFor="task-due">Due</label>
          <input disabled={sourceManaged} id="task-due" onInput={(event) => { const value = event.currentTarget.value; setDraft((current) => ({ ...current, dirty: true, dueAt: value })); }} onChange={(event) => { const value = event.currentTarget.value; setDraft((current) => ({ ...current, dirty: true, dueAt: value })); }} type="datetime-local" value={dueAt} />
        </div>
        <div className={`alarm-field ${task.needsAttention ? "needs-attention" : ""}`}>
          <label htmlFor="task-alarm">Attention alarm</label>
          <input id="task-alarm" onInput={(event) => { const value = event.currentTarget.value; setDraft((current) => ({ ...current, dirty: true, alarmAt: value })); }} onChange={(event) => { const value = event.currentTarget.value; setDraft((current) => ({ ...current, dirty: true, alarmAt: value })); }} type="datetime-local" value={alarmAt} />
          {task.needsAttention ? (
            <button className="secondary-button alarm-clear" disabled={saving} onClick={() => void clearAlarm()} type="button">
              Clear alarm
            </button>
          ) : null}
        </div>
      </div>

      {saveError ? <p className="detail-conflict" role="alert">{saveError}</p> : null}

      <button className="primary-button detail-save" disabled={!title.trim() || saving} type="submit">
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

const previewActionLabels: Record<ShortcutPreviewAction, string> = {
  create: "Create",
  update: "Update",
  complete: "Complete",
  reopen: "Reopen",
  archive: "Archive",
  ignore: "No change",
};

function ShortcutPreviewView({ initialConnection, onConnectionChanged, onReviewCountChanged, onTasksChanged }: {
  initialConnection?: ShortcutConnection;
  onConnectionChanged: (connection: ShortcutConnection) => void;
  onReviewCountChanged: (count: number) => void;
  onTasksChanged: () => Promise<void>;
}) {
  const [connection, setConnection] = useState<ShortcutConnection | undefined>(initialConnection);
  const [diagnostics, setDiagnostics] = useState<ShortcutDiagnostics>();
  const [preview, setPreview] = useState<ShortcutPreview>();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [changingMode, setChangingMode] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
  const [notifications, setNotifications] = useState<WebPushState>("disabled");
  const [changingNotifications, setChangingNotifications] = useState(false);
  const [ruleV2Shadow, setRuleV2Shadow] = useState<ShortcutRuleV2Shadow>();
  const [shadowLoading, setShadowLoading] = useState(false);
  const [shadowError, setShadowError] = useState<string>();

  useAdaptiveRefresh(async () => {
    try {
      const next = await api.shortcutDiagnostics();
      setDiagnostics(next);
      setConnection(next.connection);
      onConnectionChanged(next.connection);
      return next;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load Shortcut connection.");
      throw caught;
    }
  });

  useEffect(() => {
    void webPushState().then(setNotifications).catch(() => setNotifications("unsupported"));
    void api.shortcutRuleV2Shadow().then(setRuleV2Shadow).catch(() => undefined);
    const countdownInterval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      window.clearInterval(countdownInterval);
    };
  }, []);

  async function refreshDiagnostics() {
    const nextDiagnostics = await api.shortcutDiagnostics();
    setDiagnostics(nextDiagnostics);
    setConnection(nextDiagnostics.connection);
    onConnectionChanged(nextDiagnostics.connection);
  }

  function recordPreview(nextPreview: ShortcutPreview) {
    setPreview(nextPreview);
    setConnection(nextPreview.connection);
    onConnectionChanged(nextPreview.connection);
    onReviewCountChanged(shortcutPendingReviewCount(nextPreview));
  }

  async function toggleNotifications() {
    setChangingNotifications(true);
    setError(undefined);
    try {
      setNotifications(notifications === "enabled" ? await disableWebPush() : await enableWebPush());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update notifications.");
    } finally {
      setChangingNotifications(false);
    }
  }

  async function runPreview() {
    setLoading(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const nextPreview = await api.shortcutPreview();
      recordPreview(nextPreview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to preview Shortcut.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshRuleV2Shadow() {
    setShadowLoading(true);
    setShadowError(undefined);
    try {
      setRuleV2Shadow(await api.shortcutRuleV2Shadow(true));
    } catch (caught) {
      setShadowError(caught instanceof Error ? caught.message : "Unable to refresh Shortcut Rule v2 shadow.");
    } finally {
      setShadowLoading(false);
    }
  }

  async function applyChanges() {
    const approvalToken = preview?.approval.token;
    if (!approvalToken) return;

    setApplying(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await api.applyShortcutChanges(approvalToken);
      await onTasksChanged();
      recordPreview(await api.shortcutPreview());
      await refreshDiagnostics();
      setNotice(`${result.applied} Shortcut ${result.applied === 1 ? "change was" : "changes were"} applied after review.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to apply Shortcut changes.");
    } finally {
      setApplying(false);
    }
  }

  async function changeMode(mode: ShortcutConnectionControlMode) {
    setChangingMode(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const nextConnection = await api.updateShortcutConnectionMode(mode);
      setConnection(nextConnection);
      onConnectionChanged(nextConnection);
      setPreview(undefined);
      if (mode !== "review") onReviewCountChanged(0);
      if (mode === "automatic") {
        await onTasksChanged();
        const nextPreview = await api.shortcutPreview();
        recordPreview(nextPreview);
        setNotice("Automatic Shortcut synchronization is active. A full reconciliation just completed.");
      } else if (mode === "review") {
        setNotice("Review mode is active. Shortcut changes require preview and approval.");
      } else {
        setNotice("Shortcut synchronization is off. Existing Tasks were preserved.");
      }
      await refreshDiagnostics();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to change Shortcut mode.");
      setConnection(await api.shortcutConnection().catch(() => connection));
    } finally {
      setChangingMode(false);
    }
  }

  async function syncNow() {
    setApplying(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await api.syncShortcutNow();
      await onTasksChanged();
      const nextPreview = await api.shortcutPreview();
      recordPreview(nextPreview);
      await refreshDiagnostics();
      setNotice(`Shortcut sync completed with ${result.applied} ${result.applied === 1 ? "change" : "changes"}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to synchronize Shortcut.");
    } finally {
      setApplying(false);
    }
  }

  const proposedItems = preview?.items.filter(({ action }) => action !== "ignore") ?? [];
  const activeConnection = diagnostics?.connection ?? preview?.connection ?? connection;
  const controlMode = activeConnection?.controlMode ?? "off";
  const countdown = activeConnection?.controlMode === "automatic"
    ? nextPollCountdown(now, activeConnection.nextRepairAt, activeConnection.repairIntervalSeconds)
    : null;

  return (
    <section className="connection-preview">
      <header className="connection-heading">
        <div>
          <p className="eyebrow">Source connection</p>
          <h1>Shortcut</h1>
          <p className="connection-copy">Choose whether Shortcut stays off, waits for review, or keeps Todo Trackr synchronized automatically. Todo Trackr never writes to Shortcut.</p>
        </div>
        <div className="connection-actions">
          {controlMode === "review" && preview?.approval.allowed ? (
            <button className="preview-button" disabled={loading || applying} onClick={applyChanges} type="button">
              <Icon name="check" />
              {applying ? "Applying…" : "Apply changes"}
            </button>
          ) : null}
          {controlMode === "automatic" ? (
            <button className="secondary-button" disabled={loading || applying || changingMode} onClick={syncNow} type="button">
              <Icon name="refresh" />
              {applying ? "Syncing…" : "Sync now"}
            </button>
          ) : null}
          {controlMode === "review" ? (
            <button className="secondary-button" disabled={loading || applying || changingMode} onClick={runPreview} type="button">
              <Icon name="refresh" />
              {loading ? "Checking Shortcut…" : preview ? "Refresh" : "Run preview"}
            </button>
          ) : null}
        </div>
      </header>

      <div className="connection-mode" aria-label="Shortcut synchronization mode" role="group">
        {(["off", "review", "automatic"] as ShortcutConnectionControlMode[]).map((mode) => (
          <button
            aria-pressed={controlMode === mode}
            disabled={changingMode}
            key={mode}
            onClick={() => void changeMode(mode)}
            type="button"
          >
            <strong>{mode === "off" ? "Off" : mode === "review" ? "Review" : "Automatic"}</strong>
            <span>{mode === "off" ? "No fetching" : mode === "review" ? "Preview and approve" : "Webhook and repair"}</span>
          </button>
        ))}
      </div>

      <ShortcutWorkflowSettingsView controlMode={controlMode} disabled={loading || applying || changingMode} onSaved={() => {
        setPreview(undefined);
        onReviewCountChanged(0);
        setNotice(controlMode === "off" ? "Workflow states saved. Enable Review or Automatic to reconcile Tasks." : controlMode === "review" ? "Workflow states saved. Run Preview to review their effect on Tasks." : "Workflow states saved. Use Sync now for immediate reconciliation.");
      }} />

      <div className="notification-setting">
        <div>
          <strong>Automation notifications</strong>
          <span>{notificationDescription(notifications)}</span>
        </div>
        <button
          className="secondary-button"
          disabled={changingNotifications || notifications === "unsupported" || notifications === "unconfigured" || notifications === "blocked"}
          onClick={() => void toggleNotifications()}
          type="button"
        >
          {changingNotifications ? "Updating…" : notifications === "enabled" ? "Turn off" : "Turn on"}
        </button>
      </div>

      {error ? <p className="banner-error" role="alert">{error}<button onClick={() => setError(undefined)} type="button">Dismiss</button></p> : null}
      {notice ? <p className="banner-success" role="status">{notice}</p> : null}

      {activeConnection ? (
        <div className="connection-vitals" aria-label="Shortcut connection activity">
          <div>
            <span>Next repair</span>
            <strong>{countdown ? `in ${countdown}` : "Not scheduled"}</strong>
            <small>{countdown ? "six-hour reconciliation safety net" : "Available in Automatic mode"}</small>
          </div>
          <div>
            <span>Last webhook</span>
            <strong>{formatConnectionTime(activeConnection.lastWebhookAt)}</strong>
            <small>Latest event-driven Shortcut update</small>
          </div>
          <div>
            <span>Last full repair</span>
            <strong>{formatConnectionTime(activeConnection.lastFullSyncAt)}</strong>
            <small>Full responsibility reconciliation</small>
          </div>
        </div>
      ) : null}

      {!preview && !loading ? (
        <div className="preview-empty">
          <span className="app-mark muted"><Icon name="shortcut" /></span>
          <h2>{controlMode === "off" ? "Shortcut is off" : controlMode === "review" ? "Ready for review" : "Automatic sync is active"}</h2>
          <p>{controlMode === "off" ? "Existing Shortcut Tasks stay exactly as they are until you choose Review or Automatic." : controlMode === "review" ? "Run a preview when you are ready. Nothing changes until you approve the proposed batch." : "Authenticated Shortcut webhooks apply individual updates as they happen, and a full reconciliation repairs missed changes every six hours."}</p>
        </div>
      ) : null}

      {preview ? (
        <>
          <div className="connection-summary">
            <div>
              <span className={`health-dot is-${preview.connection.health}`} />
              <span>{preview.connection.controlMode} · {preview.connection.health}</span>
            </div>
            <div>{preview.rule.name} · Version {preview.rule.version}</div>
            <div>Generated {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(preview.generatedAt))}</div>
          </div>

          <div className="preview-counts" aria-label="Proposed Shortcut changes">
            {(["create", "reopen", "complete", "archive", "update"] as ShortcutPreviewAction[]).map((action) => (
              <div key={action}>
                <span>{previewActionLabels[action]}</span>
                <strong>{preview.counts[action]}</strong>
              </div>
            ))}
          </div>

          <div className="preview-rule-states">
            <details>
              <summary>View Rule Version {preview.rule.version} state mapping</summary>
              <div className="state-columns">
                <div><h3>Creates or reopens</h3><p>{Object.values(preview.rule.activeStates).join(", ")}</p></div>
                <div><h3>Completes</h3><p>{Object.values(preview.rule.completionStates).join(", ")}</p></div>
              </div>
            </details>
          </div>

          <div className="preview-results">
            <div className="preview-results-heading">
              <h2>Proposed changes</h2>
              <span>{proposedItems.length} proposed</span>
            </div>
            {proposedItems.length === 0 ? <p className="empty-state">Shortcut and Todo Trackr already agree.</p> : null}
            {proposedItems.map((item) => (
              <article className="preview-item" key={`${item.externalReference}:${item.action}`}>
                <div className="preview-item-main">
                  <span className={`action-badge is-${item.action}`}>{previewActionLabels[item.action]}</span>
                  <div>
                    <a href={item.sourceUrl} rel="noreferrer" target="_blank">SC-{item.externalReference}</a>
                    <h3>{item.title}</h3>
                    {item.sourceSummary ? <p className="preview-excerpt">{item.sourceSummary}</p> : null}
                  </div>
                </div>
                <div className="preview-item-meta">
                  <span>{item.workflowStateName}</span>
                  <span>{item.priority === "none" ? "No priority" : item.priority}</span>
                  {item.size ? <span>Size {item.size}</span> : null}
                  {item.dueDate ? <span>Due {item.dueDate}</span> : null}
                </div>
                <p className="preview-reason">{item.reason}</p>
              </article>
            ))}
          </div>
          <details className="preview-diagnostics">
            <summary>Run details</summary>
            <p>{preview.evaluatedCount} Shortcut {preview.evaluatedCount === 1 ? "story was" : "stories were"} evaluated. {preview.counts.ignore} required no change.</p>
          </details>
        </>
      ) : null}

      <section className="rule-shadow">
        <div className="rule-shadow-heading">
          <div>
            <p className="eyebrow">Proposed automation rule</p>
            <h2>Shortcut Responsibility Rule v2</h2>
            <p>Shadow mode observes Assigned, Requester Background, and Heads Up Responsibilities. It never changes Tasks.</p>
          </div>
          <button className="secondary-button" disabled={shadowLoading} onClick={() => void refreshRuleV2Shadow()} type="button">
            <Icon name="refresh" />
            {shadowLoading ? "Observing…" : "Refresh shadow"}
          </button>
        </div>
        {shadowError ? <p className="banner-error" role="alert">{shadowError}</p> : null}
        {ruleV2Shadow ? (
          <>
            <div className="rule-shadow-counts">
              <div><span>Primary</span><strong>{ruleV2Shadow.counts.primary}</strong></div>
              <div><span>Heads Up</span><strong>{ruleV2Shadow.counts.heads_up}</strong></div>
              <div><span>Background</span><strong>{ruleV2Shadow.counts.background}</strong></div>
              <div><span>QA hold</span><strong>{ruleV2Shadow.counts.hold}</strong></div>
            </div>
            <p className="rule-shadow-coverage">
              {ruleV2Shadow.coverageStartedAt
                ? `Observing since ${formatConnectionTime(ruleV2Shadow.coverageStartedAt)} · ${ruleV2Shadow.items.length} current candidates`
                : "No v2 candidates have been observed yet."}
            </p>
            <div className="rule-shadow-items">
              {ruleV2Shadow.items.filter(({ outcome }) => outcome !== "ignore").slice(0, 25).map((item) => (
                <article className={`rule-shadow-item is-${item.salience}`} key={item.externalReference}>
                  <div>
                    <span className={`shadow-badge is-${item.salience}`}>
                      {item.salience === "primary" ? "Primary" : item.salience === "heads_up" ? "Heads Up" : "Background"}
                    </span>
                    <a href={item.sourceUrl} rel="noreferrer" target="_blank">SC-{item.externalReference}</a>
                    <strong>{item.title}</strong>
                  </div>
                  <div className="rule-shadow-meta">
                    <span>{item.workflowStateName}</span>
                    <span>{item.outcome === "hold" ? "Leave open" : item.outcome}</span>
                  </div>
                  <p>{item.reasonSummary}</p>
                </article>
              ))}
            </div>
          </>
        ) : <p className="history-empty">Apply migration 0008, then refresh the shadow to start the one-week comparison.</p>}
      </section>

      {diagnostics ? (
        <div className="connection-history-grid">
          <section className="connection-history">
            <div className="history-heading"><h2>Sync history</h2><span>Last {diagnostics.syncRuns.length}</span></div>
            {diagnostics.syncRuns.length === 0 ? <p className="history-empty">No synchronization runs recorded yet.</p> : null}
            {diagnostics.syncRuns.map((run) => <SyncHistoryRow key={run.id} run={run} />)}
          </section>
          <section className="connection-history">
            <div className="history-heading"><h2>Connection activity</h2><span>Rule decisions</span></div>
            {diagnostics.activity.length === 0 ? <p className="history-empty">No automated Task changes recorded yet.</p> : null}
            {diagnostics.activity.map((item) => (
              <article className="history-row" key={item.id}>
                <span className={`history-status is-${item.action}`}>{item.action}</span>
                <div>
                  <strong>{item.externalReference ? `SC-${item.externalReference} · ` : ""}{item.taskTitle}</strong>
                  <p>{item.reason}</p>
                </div>
                <time dateTime={item.createdAt}>{formatConnectionTime(item.createdAt)}</time>
              </article>
            ))}
          </section>
        </div>
      ) : null}
    </section>
  );
}

function formatConnectionTime(value: string | null): string {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function notificationDescription(state: WebPushState): string {
  if (state === "enabled") return "This device receives grouped Shortcut lifecycle and sync health updates.";
  if (state === "unconfigured") return "Add the three VAPID environment variables to enable Web Push.";
  if (state === "blocked") return "Notifications are blocked in this browser's site settings.";
  if (state === "unsupported") return "Web Push is unavailable in this browser or app context.";
  return "Receive grouped Shortcut lifecycle and sync health updates on this device.";
}

function syncRunSummary(run: ShortcutSyncRun): string {
  const changed = Object.entries(run.counts)
    .filter(([, count]) => count > 0)
    .map(([action, count]) => `${count} ${action}`)
    .join(" · ");
  return run.errorMessage ?? (changed || "No Task changes");
}

function SyncHistoryRow({ run }: { run: ShortcutSyncRun }) {
  return (
    <article className="history-row">
      <span className={`history-status is-${run.status}`}>{run.status}</span>
      <div>
        <strong>{run.trigger === "poll" ? "Legacy incremental poll" : run.trigger === "scheduled" ? "Full repair" : `${run.trigger} sync`}</strong>
        <p>{syncRunSummary(run)}</p>
      </div>
      <time dateTime={run.startedAt}>{formatConnectionTime(run.startedAt)}</time>
    </article>
  );
}

function GranolaConnectionView({ onConnectionChanged, onReviewCountChanged, onTasksChanged }: {
  onConnectionChanged: (connection: GranolaConnection) => void;
  onReviewCountChanged: (count: number) => void;
  onTasksChanged: () => Promise<void>;
}) {
  const [diagnostics, setDiagnostics] = useState<GranolaDiagnostics>();
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [reviewingId, setReviewingId] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  async function refresh() {
    const next = await api.granolaDiagnostics();
    setDiagnostics(next);
    onConnectionChanged(next.connection);
    onReviewCountChanged(next.pendingReviewCount);
    return next;
  }

  useAdaptiveRefresh(async () => {
    try { return await refresh(); }
    catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load Granola diagnostics.");
      throw caught;
    } finally { setLoading(false); }
  });

  async function scanRecentNotes() {
    setScanning(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await api.backfillGranola(7);
      await Promise.all([refresh(), onTasksChanged()]);
      setNotice(`Scanned ${result.notesScanned} recent ${result.notesScanned === 1 ? "meeting" : "meetings"}. ${result.reviewCandidates} personal ${result.reviewCandidates === 1 ? "next step needs" : "next steps need"} review.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to scan recent Granola meetings.");
    } finally {
      setScanning(false);
    }
  }

  async function reviewCandidate(id: string, decision: "accept" | "dismiss") {
    setReviewingId(id);
    setError(undefined);
    try {
      const next = decision === "accept"
        ? await api.acceptGranolaReviewCandidate(id)
        : await api.dismissGranolaReviewCandidate(id);
      setDiagnostics(next);
      onConnectionChanged(next.connection);
      onReviewCountChanged(next.pendingReviewCount);
      if (decision === "accept") await onTasksChanged();
      setNotice(decision === "accept" ? "Granola next step added to Todo Trackr." : "Granola next step dismissed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to review the Granola next step.");
    } finally {
      setReviewingId(undefined);
    }
  }

  const connection = diagnostics?.connection;

  return (
    <section className="connection-preview">
      <header className="connection-heading">
        <div>
          <p className="eyebrow">Source connection</p>
          <h1>Granola</h1>
          <p className="connection-copy">Every Granola Task requires your approval. Webhooks discover personal next steps promptly, and a six-hour repair checks for missed updates.</p>
        </div>
        <div className="connection-actions">
          <button className="secondary-button" disabled={loading || scanning} onClick={() => void scanRecentNotes()} type="button">
            <Icon name="refresh" />
            {scanning ? "Scanning…" : "Scan last 7 days"}
          </button>
        </div>
      </header>

      {error ? <p className="banner-error" role="alert">{error}</p> : null}
      {notice ? <p className="banner-notice" role="status">{notice}</p> : null}

      <div className="connection-summary">
        <div><span className={`health-dot is-${connection?.health ?? "paused"}`} />{connection?.health ?? (loading ? "Loading" : "Unavailable")}</div>
        <span>Last successful capture {formatConnectionTime(connection?.lastSuccessAt ?? null)}</span>
        <span>Repair schedule Every six hours</span>
      </div>

      <section className="granola-schedule" aria-label="Granola delivery and repair">
        <div className="granola-schedule-heading">
          <div>
            <h2>Webhook-first delivery</h2>
            <p>Signed webhooks handle prompt discovery. The six-hour repair recovers missed events, and the manual seven-day scan remains available above.</p>
          </div>
        </div>
      </section>

      <section className="granola-review">
        <div className="history-heading">
          <h2>Needs review</h2>
          <span>{diagnostics?.pendingReviewCount ?? 0} candidates</span>
        </div>
        {diagnostics?.reviewCandidates.length === 0 ? <p className="history-empty">No personal Granola next steps are waiting for review.</p> : null}
        {diagnostics?.reviewCandidates.map((candidate) => (
          <article className="granola-review-item" key={candidate.id}>
            <div>
              <a href={candidate.sourceUrl} rel="noreferrer" target="_blank">Open meeting</a>
              <strong>{candidate.title}</strong>
              <p>{candidate.sourceExcerpt}</p>
            </div>
            <div className="granola-review-actions">
              <button className="secondary-button" disabled={reviewingId === candidate.id} onClick={() => void reviewCandidate(candidate.id, "dismiss")} type="button">Dismiss</button>
              <button className="preview-button" disabled={reviewingId === candidate.id} onClick={() => void reviewCandidate(candidate.id, "accept")} type="button">Add Task</button>
            </div>
          </article>
        ))}
      </section>

      <div className="connection-history-grid">
        <section className="connection-history">
          <div className="history-heading"><h2>Capture runs</h2><span>Recent scans and webhooks</span></div>
          {diagnostics?.syncRuns.length === 0 ? <p className="history-empty">No Granola capture runs recorded yet.</p> : null}
          {diagnostics?.syncRuns.map((run) => (
            <article className="history-row" key={run.id}>
              <span className={`history-status is-${run.status}`}>{run.status}</span>
              <div>
                <strong>{run.trigger === "webhook" ? "Webhook capture" : run.trigger === "scheduled" ? "Automatic meeting scan" : "Recent meeting scan"}</strong>
                <p>{run.errorMessage ?? `${run.counts.created ?? 0} created · ${run.counts.review ?? 0} review · ${run.counts.notes ?? run.counts.received ?? 0} inspected`}</p>
              </div>
              <time dateTime={run.startedAt}>{formatConnectionTime(run.startedAt)}</time>
            </article>
          ))}
        </section>
        <section className="connection-history">
          <div className="history-heading"><h2>Webhook deliveries</h2><span>Latest {diagnostics?.events.length ?? 0}</span></div>
          {diagnostics?.events.length === 0 ? <p className="history-empty">No Granola webhook deliveries recorded yet.</p> : null}
          {diagnostics?.events.map((event) => (
            <article className="history-row" key={event.id}>
              <span className={`history-status is-${event.status}`}>{event.status}</span>
              <div>
                <strong>{event.noteId ?? "Unknown meeting"}</strong>
                <p>{event.detail ?? "Granola note processed."}</p>
              </div>
              <time dateTime={event.receivedAt}>{formatConnectionTime(event.receivedAt)}</time>
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}

function CodexConnectionView({ onDiagnosticsChanged }: {
  onDiagnosticsChanged: (diagnostics: CodexDiagnostics) => void;
}) {
  const [diagnostics, setDiagnostics] = useState<CodexDiagnostics>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  async function refresh() {
    setError(undefined);
    const next = await api.codexDiagnostics();
    setDiagnostics(next);
    onDiagnosticsChanged(next);
    return next;
  }

  useAdaptiveRefresh(async () => {
    try { return await refresh(); }
    catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load Codex diagnostics.");
      throw caught;
    } finally { setLoading(false); }
  });

  const activeCount = (diagnostics?.counts.queued ?? 0) + (diagnostics?.counts.working ?? 0);
  const needsYouCount = (diagnostics?.counts.waiting_for_you ?? 0) + (diagnostics?.counts.ready_for_review ?? 0);

  return (
    <section className="connection-preview">
      <header className="connection-heading">
        <div>
          <p className="eyebrow">Work connection</p>
          <h1>Codex</h1>
          <p className="connection-copy">Attach a Codex conversation to any Task, then see what is active, blocked, or ready for your review without copying the chat into Todo Trackr.</p>
        </div>
        <div className="connection-actions">
          <button className="secondary-button" disabled={loading} onClick={() => void refresh()} type="button"><Icon name="refresh" />Refresh</button>
        </div>
      </header>

      {error ? <p className="banner-error" role="alert">{error}</p> : null}

      <div className="connection-summary">
        <div><span className={`health-dot is-${diagnostics?.connection.health ?? "paused"}`} />{diagnostics?.connection.health ?? (loading ? "Loading" : "Unavailable")}</div>
        <span>Last update {formatConnectionTime(diagnostics?.connection.lastSuccessAt ?? null)}</span>
        <span>Observe-only foundation</span>
      </div>

      <div className="connection-vitals codex-vitals">
        <div><span>Active</span><strong>{activeCount}</strong><small>Queued or in progress</small></div>
        <div><span>Needs you</span><strong>{needsYouCount}</strong><small>Waiting or ready for review</small></div>
        <div><span>Finished</span><strong>{diagnostics?.counts.finished ?? 0}</strong><small>Completed Codex sessions</small></div>
      </div>

      <section className="connection-history codex-session-history">
        <div className="history-heading"><h2>Current work sessions</h2><span>Latest {diagnostics?.sessions.length ?? 0}</span></div>
        {diagnostics?.sessions.length === 0 ? <p className="history-empty">Attach a conversation from any Task detail panel. A trusted bridge can later send live progress to the ingest endpoint.</p> : null}
        {diagnostics?.sessions.map((session) => (
          <article className="history-row codex-history-row" key={session.id}>
            <span className={`history-status is-${session.status}`}>{codexStatusLabels[session.status]}</span>
            <div>
              <strong>{session.taskTitle}</strong>
              <p>{session.latestSummary ?? session.title ?? "Conversation attached, waiting for a progress update."}</p>
            </div>
            <div className="codex-history-links">
              {session.threadUrl ? <a href={session.threadUrl} rel="noreferrer" target="_blank">Open Codex</a> : null}
              {session.prUrl ? <a href={session.prUrl} rel="noreferrer" target="_blank">Open PR</a> : null}
              <time dateTime={session.updatedAt}>{formatConnectionTime(session.updatedAt)}</time>
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}

function usesCompactTaskDetails(): boolean {
  return window.matchMedia("(max-width: 1050px)").matches;
}

function useMobileViewport(): boolean {
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => window.matchMedia(MOBILE_WORKSPACE_MEDIA_QUERY).matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_WORKSPACE_MEDIA_QUERY);
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);
    mediaQuery.addEventListener("change", updateViewport);
    updateViewport();
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  return isMobileViewport;
}

function Workspace({ onLogout }: { onLogout: () => void }) {
  const installation = useInstallation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lists, setLists] = useState<TaskList[]>([]);
  const [view, setView] = useState<ViewKey>(() => {
    const initial = initialConnectionView(window.location.search);
    if (initial === "connection:shortcut" && !installation.integrations.shortcut) return "inbox";
    if (initial === "connection:granola" && !installation.integrations.granola) return "inbox";
    return initial;
  });
  const [selectedId, setSelectedId] = useState<string | undefined>(
    () => new URLSearchParams(window.location.search).get("task") ?? undefined,
  );
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"any" | TaskPriority>("any");
  const [dueFilter, setDueFilter] = useState<DueFilter>("any");
  const [sort, setSort] = useState<SortMode>("smart");
  const [workspaceLayout, setWorkspaceLayout] = useState<WorkspaceLayout>(() => readWorkspaceLayout(window.localStorage));
  const isMobileViewport = useMobileViewport();
  const effectiveWorkspaceLayout = workspaceLayoutForViewport(workspaceLayout, isMobileViewport);
  const workSwitchLabel = useWorkSwitch(installation.workSwitch);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(() => installation.integrations.shortcut ? readWorkspaceMode() : "tasks");
  const [newListName, setNewListName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [syncState, setSyncState] = useState<SyncState>("syncing");
  const [shortcutConnection, setShortcutConnection] = useState<ShortcutConnection>();
  const [granolaConnection, setGranolaConnection] = useState<GranolaConnection>();
  const [codexDiagnostics, setCodexDiagnostics] = useState<CodexDiagnostics>();
  const [systemHealth, setSystemHealth] = useState<SystemHealth>();
  const [shortcutReviewCount, setShortcutReviewCount] = useState(0);
  const [granolaReviewCount, setGranolaReviewCount] = useState(0);
  const [completionFeedback, setCompletionFeedback] = useState<Record<string, CompletionFeedbackPhase>>({});
  const completionFeedbackRef = useRef<Record<string, CompletionFeedbackPhase>>({});
  const listsRef = useRef<TaskList[]>([]);
  const refreshInFlight = useRef(false);
  const lastTaskSnapshot = useRef<string | null>(null);
  const unchangedTaskPolls = useRef(0);
  const nextTaskPollAt = useRef(0);
  const viewRef = useRef<ViewKey>("inbox");
  const workspaceLayoutRef = useRef<WorkspaceLayout>(effectiveWorkspaceLayout);
  const workspaceModeRef = useRef<WorkspaceMode>(workspaceMode);
  viewRef.current = view;
  workspaceLayoutRef.current = effectiveWorkspaceLayout;
  workspaceModeRef.current = workspaceMode;
  listsRef.current = lists;

  async function load(includeMetadata = true) {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setSyncState("syncing");

    try {
      setError(undefined);
      let nextTasks: Task[];
      let nextLists = listsRef.current;
      let nextShortcutConnection: ShortcutConnection | undefined;
      let nextGranolaDiagnostics: GranolaDiagnostics | undefined;
      let nextCodexDiagnostics: CodexDiagnostics | undefined;

      if (includeMetadata) {
        [nextTasks, nextLists, nextShortcutConnection, nextGranolaDiagnostics, nextCodexDiagnostics] = await Promise.all([
          api.tasks(),
          api.lists(),
          installation.integrations.shortcut ? api.shortcutConnection().catch(() => undefined) : Promise.resolve(undefined),
          installation.integrations.granola ? api.granolaDiagnostics().catch(() => undefined) : Promise.resolve(undefined),
          installation.integrations.codex ? api.codexDiagnostics().catch(() => undefined) : Promise.resolve(undefined),
        ]);
      } else {
        nextTasks = await api.tasks();
      }
      const snapshot = JSON.stringify(nextTasks);
      unchangedTaskPolls.current = lastTaskSnapshot.current === snapshot ? unchangedTaskPolls.current + 1 : 0;
      lastTaskSnapshot.current = snapshot;
      nextTaskPollAt.current = Date.now() + nextTaskPollIntervalMs(unchangedTaskPolls.current);
      setTasks((current) => preservePendingCompletions(
        current,
        nextTasks,
        new Set(Object.keys(completionFeedbackRef.current)),
      ));
      if (includeMetadata) setLists(nextLists);
      if (nextShortcutConnection) setShortcutConnection(nextShortcutConnection);
      if (nextGranolaDiagnostics) {
        setGranolaConnection(nextGranolaDiagnostics.connection);
        setGranolaReviewCount(nextGranolaDiagnostics.pendingReviewCount);
      }
      if (nextCodexDiagnostics) setCodexDiagnostics(nextCodexDiagnostics);
      const nextInboxId = nextLists.find((list) => list.isInbox)?.id ?? "00000000-0000-4000-8000-000000000001";
      const nextViewTasks = isConnectionView(viewRef.current)
        ? []
        : tasksForView(nextTasks, viewRef.current, nextInboxId);
      setSelectedId((current) => {
        if (workspaceModeRef.current === "shortcut") return undefined;
        if (current && nextViewTasks.some((task) => task.id === current)) return current;
        return workspaceLayoutRef.current === "compact" || usesCompactTaskDetails() ? undefined : nextViewTasks[0]?.id;
      });
      setSyncState("synced");
    } catch (caught) {
      if (caught instanceof APIError && caught.status === 401) {
        onLogout();
        return;
      }
      setError(caught instanceof Error ? caught.message : "Unable to load tasks.");
      setSyncState("error");
      nextTaskPollAt.current = Date.now() + WORKSPACE_POLL_INTERVAL_MS;
    } finally {
      refreshInFlight.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();

    const refreshTasks = () => {
      if (automaticWorkAllowed(installation.workSwitch) && workspaceModeRef.current === "tasks" && !isConnectionView(viewRef.current)) {
        void load(false);
      }
    };
    const refreshOnReturn = () => {
      if (!shouldPollWorkspace(document.visibilityState)) return;
      unchangedTaskPolls.current = 0;
      refreshTasks();
    };
    const refreshWhenVisible = () => {
      if (automaticWorkAllowed(installation.workSwitch) && shouldPollWorkspace(document.visibilityState) && Date.now() >= nextTaskPollAt.current) refreshTasks();
    };
    const interval = window.setInterval(refreshWhenVisible, WORKSPACE_POLL_INTERVAL_MS);

    window.addEventListener("app-switchr-resumed", refreshOnReturn);
    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("app-switchr-resumed", refreshOnReturn);
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, []);

  useEffect(() => {
    if (shortcutConnection?.controlMode !== "review") {
      setShortcutReviewCount(0);
      return;
    }

    let cancelled = false;
    void api.shortcutPreview()
      .then((preview) => {
        if (!cancelled) setShortcutReviewCount(shortcutPendingReviewCount(preview));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [shortcutConnection?.controlMode]);

  const inboxId = lists.find((list) => list.isInbox)?.id ?? "00000000-0000-4000-8000-000000000001";
  const viewTasks = useMemo(
    () => isConnectionView(view) ? [] : tasksForView(tasks, view, inboxId),
    [tasks, view, inboxId],
  );
  const visibleTasks = useMemo(() => queryTasks(viewTasks, {
    search,
    priority: priorityFilter,
    due: dueFilter,
    sort: view === "recent" ? "newest" : sort,
  }), [viewTasks, search, priorityFilter, dueFilter, sort, view]);
  const visibleTaskSections = useMemo(
    () => isConnectionView(view) ? [] : taskSections(visibleTasks, view),
    [visibleTasks, view],
  );
  const selectedTask = tasks.find((task) => task.id === selectedId);
  const activeListId = view.startsWith("list:") ? view.slice(5) : inboxId;

  async function create(title: string) {
    try {
      const task = await api.createTask({ title, listId: activeListId });
      setTasks((current) => [task, ...current]);
      setSelectedId(effectiveWorkspaceLayout === "compact" || usesCompactTaskDetails() ? undefined : task.id);
      if (!view.startsWith("list:")) setView(activeListId === inboxId ? "inbox" : `list:${activeListId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create task.");
    }
  }

  async function update(task: Task, input: UpdateTaskInput) {
    try {
      const updated = await api.updateTask(task, input);
      setTasks((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (updated.status === "completed" && view !== "completed" && selectedId === updated.id) {
        setSelectedId(undefined);
      }
    } catch (caught) {
      if (caught instanceof APIError && caught.code === "TASK_CONFLICT" && caught.currentTask) {
        setTasks((current) => current.map((item) => item.id === caught.currentTask?.id ? caught.currentTask : item));
      }
      setError(caught instanceof Error ? caught.message : "Unable to update task.");
      throw caught;
    }
  }

  function setCompletionPhase(taskId: string, phase?: CompletionFeedbackPhase) {
    const next = { ...completionFeedbackRef.current };
    if (phase) next[taskId] = phase;
    else delete next[taskId];
    completionFeedbackRef.current = next;
    setCompletionFeedback(next);
  }

  async function toggle(task: Task) {
    if (task.status === "completed") {
      await update(task, { status: "open" });
      return;
    }

    setCompletionPhase(task.id, "confirming");
    const minimumHold = new Promise((resolve) => window.setTimeout(resolve, COMPLETION_HOLD_MS));

    try {
      const [updated] = await Promise.all([
        api.updateTask(task, { status: "completed" }),
        minimumHold,
      ]);
      setCompletionPhase(task.id, "exiting");
      await new Promise((resolve) => window.setTimeout(resolve, COMPLETION_EXIT_MS));
      setTasks((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (selectedId === updated.id) setSelectedId(undefined);
      setCompletionPhase(task.id);
    } catch (caught) {
      setCompletionPhase(task.id);
      setError(caught instanceof Error ? caught.message : "Unable to complete task.");
    }
  }

  async function toggleStar(task: Task) {
    try {
      await update(task, { isStarred: !task.isStarred });
    } catch {
      // update surfaces the actionable error in the workspace banner.
    }
  }

  async function remove(task: Task) {
    try {
      await api.deleteTask(task.id);
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setSelectedId(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete task.");
    }
  }

  async function logout() {
    await api.logout().catch(() => undefined);
    onLogout();
  }

  const smartViews: Array<{ id: SmartView; label: string; icon: "alert" | "archive" | "calendar" | "check" | "clock" | "inbox" | "list" | "star" }> = [
    { id: "inbox", label: "Inbox", icon: "inbox" },
    { id: "today", label: "Today", icon: "calendar" },
    { id: "upcoming", label: "Upcoming", icon: "calendar" },
    { id: "overdue", label: "Overdue", icon: "alert" },
    { id: "all", label: "All", icon: "list" },
    { id: "starred", label: "Starred", icon: "star" },
    { id: "recent", label: "Recent", icon: "clock" },
    { id: "completed", label: "Completed", icon: "check" },
    { id: "archived", label: "Archived", icon: "archive" },
  ];
  const syncLabel = syncState === "syncing" ? "Syncing" : syncState === "error" ? "Offline" : "Synced";
  const viewLabel = view.startsWith("list:")
    ? lists.find((list) => list.id === view.slice(5))?.name ?? "List"
    : view === "connection:shortcut"
      ? "Shortcut"
    : view === "connection:granola"
      ? "Granola"
    : view === "connection:codex"
      ? "Codex"
    : view === "connection:system"
      ? "System health"
    : view === "source:shortcut"
      ? "Shortcut"
    : view === "source:granola"
      ? "Granola"
    : view === "source:slack"
      ? "Slack"
    : smartViews.find((item) => item.id === view)?.label ?? "Tasks";

  function selectView(nextView: ViewKey) {
    const isReturningToTasks = isConnectionView(view) && !isConnectionView(nextView);
    setWorkspaceMode("tasks");
    window.localStorage.setItem(WORKSPACE_MODE_STORAGE_KEY, "tasks");
    setView(nextView);
    setSelectedId(
      isConnectionView(nextView) || effectiveWorkspaceLayout === "compact" || usesCompactTaskDetails()
        ? undefined
        : tasksForView(tasks, nextView, inboxId)[0]?.id,
    );
    if (isReturningToTasks) void load(false);
  }

  function showShortcutBoard() {
    if (isConnectionView(view)) setView("inbox");
    setSelectedId(undefined);
    setWorkspaceMode("shortcut");
    window.localStorage.setItem(WORKSPACE_MODE_STORAGE_KEY, "shortcut");
  }

  function showTasks() {
    setWorkspaceMode("tasks");
    window.localStorage.setItem(WORKSPACE_MODE_STORAGE_KEY, "tasks");
    void load(false);
  }

  function changeWorkspaceLayout(nextLayout: WorkspaceLayout) {
    setWorkspaceLayout(nextLayout);
    writeWorkspaceLayout(window.localStorage, nextLayout);
    if (nextLayout === "compact") {
      if (isConnectionView(view)) setView("inbox");
      setSelectedId(undefined);
    }
  }

  async function createList(event: FormEvent) {
    event.preventDefault();
    const name = newListName.trim();
    if (!name) return;
    try {
      const list = await api.createList(name);
      setLists((current) => [...current, list]);
      setNewListName("");
      selectView(`list:${list.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create list.");
    }
  }

  return (
    <main className={`workspace is-${effectiveWorkspaceLayout} ${isConnectionView(view) ? "is-connection-view" : ""}`}>
      <aside className="sidebar">
        {workSwitchLabel && <p className="sidebar-heading" role="status">{workSwitchLabel}</p>}
        <div className="brand"><span className="app-mark small"><Icon name="check" /></span><span>Todo Trackr</span></div>
        <nav aria-label="Task filters">
          {smartViews.map((item) => (
            <button className={view === item.id ? "active" : ""} key={item.id} onClick={() => selectView(item.id)} title={item.label} type="button">
              <Icon name={item.icon} />
              <span className="sidebar-label">{item.label}</span>
              <span className="count">{tasksForView(tasks, item.id, inboxId).length}</span>
            </button>
          ))}
        </nav>
        <div className="list-section">
          <p className="sidebar-heading">My lists</p>
          <nav aria-label="Lists">
            {lists.filter((list) => !list.isInbox).map((list) => (
              <button className={view === `list:${list.id}` ? "active" : ""} key={list.id} onClick={() => selectView(`list:${list.id}`)} title={list.name} type="button">
                <Icon name="folder" />
                <span className="sidebar-label">{list.name}</span>
                <span className="count">{tasksForView(tasks, `list:${list.id}`, inboxId).length}</span>
              </button>
            ))}
          </nav>
          <form className="new-list" onSubmit={createList}>
            <input aria-label="New list name" onChange={(event) => setNewListName(event.target.value)} placeholder="New list" value={newListName} />
            <button aria-label="Create list" disabled={!newListName.trim()} type="submit"><Icon name="plus" /></button>
          </form>
        </div>
        {(installation.integrations.shortcut || installation.integrations.granola) ? <div className="list-section source-section">
          <p className="sidebar-heading">Sources</p>
          <nav aria-label="Sources">
            {installation.integrations.shortcut ? <button className={view === "source:shortcut" ? "active" : ""} onClick={() => selectView("source:shortcut")} title="Shortcut" type="button">
              <Icon name="shortcut" />
              <span className="sidebar-label">Shortcut</span>
              <span className="count">{tasksForView(tasks, "source:shortcut", inboxId).length}</span>
            </button> : null}
            {installation.integrations.granola ? <button className={view === "source:granola" ? "active" : ""} onClick={() => selectView("source:granola")} title="Granola" type="button">
              <Icon name="shortcut" />
              <span className="sidebar-label">Granola</span>
              <span className="count">{tasksForView(tasks, "source:granola", inboxId).length}</span>
            </button> : null}
            <button className={view === "source:slack" ? "active" : ""} onClick={() => selectView("source:slack")} title="Slack" type="button">
              <Icon name="shortcut" />
              <span className="sidebar-label">Slack</span>
              <span className="count">{tasksForView(tasks, "source:slack", inboxId).length}</span>
            </button>
          </nav>
        </div> : null}
        <div className="list-section source-section">
          <p className="sidebar-heading">Settings</p>
          <nav aria-label="Settings">
            {installation.integrations.shortcut ? <button
              className={view === "connection:shortcut" ? "active" : ""}
              onClick={() => selectView("connection:shortcut")}
              title={shortcutReviewCount > 0 ? `${shortcutReviewCount} Shortcut items need review` : "Shortcut setup"}
              type="button"
            >
              <Icon name="shortcut" />
              <span className="sidebar-label">Shortcut setup</span>
              <span className="connection-indicators">
                {shortcutReviewCount > 0 ? (
                  <span
                    aria-label={`${shortcutReviewCount} Shortcut items need review`}
                    className="connection-review-count"
                    title={`${shortcutReviewCount} Shortcut items need review`}
                  >
                    {formatReviewCount(shortcutReviewCount)}
                  </span>
                ) : null}
                <span
                  className={`source-status-dot is-${shortcutConnection?.health ?? "paused"}`}
                  title={shortcutConnection ? `${shortcutConnection.controlMode} · ${shortcutConnection.health}` : "Connection status unavailable"}
                />
              </span>
            </button> : null}
            {installation.integrations.granola ? <button
              className={view === "connection:granola" ? "active" : ""}
              onClick={() => selectView("connection:granola")}
              title={granolaReviewCount > 0 ? `${granolaReviewCount} Granola items need review` : "Granola setup"}
              type="button"
            >
              <Icon name="shortcut" />
              <span className="sidebar-label">Granola setup</span>
              <span className="connection-indicators">
                {granolaReviewCount > 0 ? (
                  <span
                    aria-label={`${granolaReviewCount} Granola items need review`}
                    className="connection-review-count"
                    title={`${granolaReviewCount} Granola items need review`}
                  >
                    {formatReviewCount(granolaReviewCount)}
                  </span>
                ) : null}
                <span
                  className={`source-status-dot is-${granolaConnection?.health ?? "paused"}`}
                  title={granolaConnection ? granolaConnection.health : "Connection status unavailable"}
                />
              </span>
            </button> : null}
            {installation.integrations.codex ? <button
              className={view === "connection:codex" ? "active" : ""}
              onClick={() => selectView("connection:codex")}
              title={(codexDiagnostics?.counts.waiting_for_you ?? 0) + (codexDiagnostics?.counts.ready_for_review ?? 0) > 0
                ? `${(codexDiagnostics?.counts.waiting_for_you ?? 0) + (codexDiagnostics?.counts.ready_for_review ?? 0)} Codex sessions need you`
                : "Codex setup"}
              type="button"
            >
              <Icon name="code" />
              <span className="sidebar-label">Codex setup</span>
              <span className="connection-indicators">
                {(codexDiagnostics?.counts.waiting_for_you ?? 0) + (codexDiagnostics?.counts.ready_for_review ?? 0) > 0 ? (
                  <span className="connection-review-count">
                    {formatReviewCount((codexDiagnostics?.counts.waiting_for_you ?? 0) + (codexDiagnostics?.counts.ready_for_review ?? 0))}
                  </span>
                ) : null}
                <span className={`source-status-dot is-${codexDiagnostics?.connection.health ?? "paused"}`} />
              </span>
            </button> : null}
            <button
              className={view === "connection:system" ? "active" : ""}
              onClick={() => selectView("connection:system")}
              title="System health and recovery"
              type="button"
            >
              <Icon name="alert" />
              <span className="sidebar-label">System health</span>
              <span className="connection-indicators">
                <span className={`source-status-dot is-${systemHealth ? (systemHealth.status === "healthy" ? "healthy" : "degraded") : "paused"}`} />
              </span>
            </button>
          </nav>
        </div>
        <div className="sidebar-footer">
          {installation.authenticationMode === "password"
            ? <button aria-label="Sign out" className="logout-button" onClick={logout} title="Sign out" type="button"><Icon name="logout" /></button>
            : <span className="access-status" title="Anyone who can reach this server can access its tasks.">No password</span>}
        </div>
      </aside>

      <div
        aria-live="polite"
        className={`sync-status floating-sync-status is-${syncState}`}
        role="status"
        title="Tasks refresh on focus and slow to every 10 minutes when unchanged"
      >
        <span aria-hidden="true" className="sync-dot" />
        <span>{syncLabel}</span>
      </div>

      {view === "connection:shortcut" ? (
        <ShortcutPreviewView
          initialConnection={shortcutConnection}
          onConnectionChanged={setShortcutConnection}
          onReviewCountChanged={setShortcutReviewCount}
          onTasksChanged={load}
        />
      ) : view === "connection:granola" ? (
        <GranolaConnectionView
          onConnectionChanged={setGranolaConnection}
          onReviewCountChanged={setGranolaReviewCount}
          onTasksChanged={load}
        />
      ) : view === "connection:codex" ? (
        <CodexConnectionView onDiagnosticsChanged={setCodexDiagnostics} />
      ) : view === "connection:system" ? (
        <SystemHealthView onHealthChanged={setSystemHealth} onTasksChanged={() => void load()} />
      ) : workspaceMode === "shortcut" ? (
        <ShortcutBoardView
          onShowTasks={showTasks}
          onToggleLayout={isMobileViewport ? undefined : () => changeWorkspaceLayout(workspaceLayout === "compact" ? "standard" : "compact")}
          workspaceLayout={effectiveWorkspaceLayout}
        />
      ) : <section className="task-panel">
        <header>
          <div className="task-heading">
            <p className="eyebrow">My workspace</p>
            <h1>{viewLabel}</h1>
          </div>
          <div className="task-header-meta">
            <span className="task-count">{visibleTasks.length} {visibleTasks.length === 1 ? "task" : "tasks"}</span>
            {installation.integrations.shortcut ? <button className="layout-toggle workspace-mode-toggle" onClick={showShortcutBoard} type="button">
              <Icon name="shortcut" />
              <span>Shortcut</span>
            </button> : null}
            {!isMobileViewport ? (
              <button
                className="layout-toggle workspace-layout-toggle"
                onClick={() => changeWorkspaceLayout(workspaceLayout === "compact" ? "standard" : "compact")}
                title={workspaceLayout === "compact" ? "Use Standard view" : "Use Compact view"}
                type="button"
              >
                <Icon name={workspaceLayout === "compact" ? "columns" : "list"} />
                <span>{workspaceLayout === "compact" ? "Standard" : "Compact"}</span>
              </button>
            ) : null}
          </div>
        </header>
        <NewTask onCreate={create} />
        <div className="task-tools">
          <input aria-label="Search tasks" onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks" type="search" value={search} />
          <select aria-label="Filter by priority" onChange={(event) => setPriorityFilter(event.target.value as "any" | TaskPriority)} value={priorityFilter}>
            <option value="any">Any priority</option>
            <option value="highest">Highest priority</option>
            <option value="high">High priority</option>
            <option value="medium">Medium priority</option>
            <option value="low">Low priority</option>
            <option value="lowest">Lowest priority</option>
            <option value="none">No priority</option>
          </select>
          <select aria-label="Filter by due date" onChange={(event) => setDueFilter(event.target.value as DueFilter)} value={dueFilter}>
            <option value="any">Any due date</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="upcoming">Upcoming</option>
            <option value="none">No due date</option>
          </select>
          <select aria-label="Sort tasks" disabled={view === "recent"} onChange={(event) => setSort(event.target.value as SortMode)} value={view === "recent" ? "newest" : sort}>
            <option value="smart">Smart sort</option>
            <option value="due">Due date</option>
            <option value="priority">Priority</option>
            <option value="newest">Newest</option>
          </select>
        </div>
        {error ? <p className="banner-error" role="alert">{error}<button onClick={() => setError(undefined)} type="button">Dismiss</button></p> : null}
        <div className="task-list">
          {loading ? <p className="empty-state">Loading tasks…</p> : null}
          {!loading && visibleTasks.length === 0 ? <p className="empty-state">Nothing here yet.</p> : null}
          {visibleTaskSections.map((section) => (
            <section className="task-section" key={section.id}>
              {section.label ? (
                <div className={`task-section-heading${section.id === "overdue" || section.id === "today" ? ` is-${section.id}` : ""}`}>
                  <h2>{section.label}</h2>
                  <span>{section.tasks.length}</span>
                </div>
              ) : null}
              {section.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  completionFeedbackPhase={completionFeedback[task.id]}
                  listName={lists.find((list) => list.id === task.listId)?.name ?? "Inbox"}
                  onSelect={() => setSelectedId(task.id)}
                  onToggle={() => void toggle(task)}
                  onToggleStar={() => void toggleStar(task)}
                  recent={view === "recent"}
                  selected={selectedId === task.id}
                  task={task}
                />
              ))}
            </section>
          ))}
        </div>
      </section>}

      {!isConnectionView(view) && workspaceMode === "tasks" ? <div className={`detail-overlay ${selectedTask ? "is-open" : ""}`}>
        {selectedTask ? (
          <TaskDetail
            key={selectedTask.id}
            compact={effectiveWorkspaceLayout === "compact"}
            lists={lists}
            onClose={() => setSelectedId(undefined)}
            onDelete={() => remove(selectedTask)}
            onSave={(input) => update(selectedTask, input)}
            onToggleStar={() => void toggleStar(selectedTask)}
            task={selectedTask}
          />
        ) : (
          <aside className="detail-panel empty-detail"><span className="app-mark muted"><Icon name="check" /></span><p>Select a task to view its details.</p></aside>
        )}
      </div> : null}
    </main>
  );
}

export function App() {
  const [auth, setAuth] = useState<AuthState>("checking");
  const [startupError, setStartupError] = useState<string>();
  const [installation, setInstallation] = useState<Installation>(legacyInstallation);

  useEffect(() => onSessionExpired(() => {
    setStartupError("Your session expired. Sign in again to continue.");
    setAuth("signed-out");
  }), []);

  useEffect(() => {
    api.installation()
      .then((settings) => { setInstallation(settings); return api.session(); })
      .then((authenticated) => setAuth(authenticated ? "signed-in" : "signed-out"))
      .catch((error) => {
        setStartupError(error instanceof Error ? error.message : "Todo Trackr is unavailable.");
        setAuth("signed-out");
      });
  }, []);

  if (auth === "checking") {
    return <main className="loading-screen"><span className="app-mark"><Icon name="check" /></span><p>Opening Todo Trackr…</p></main>;
  }

  if (auth === "signed-out") {
    return <><Login onSuccess={() => { setStartupError(undefined); setAuth("signed-in"); }} />{startupError ? <p className="startup-error">{startupError}</p> : null}</>;
  }

  return <InstallationContext.Provider value={installation}><Workspace onLogout={() => setAuth("signed-out")} /></InstallationContext.Provider>;
}

import { useMemo, useState } from "react";

import { api } from "./api.js";
import { queryShortcutBoard, shortcutBoardSections } from "./shortcutBoard.js";
import { ShortcutStateDueLabel, shortcutDueDateLabel } from "./ShortcutStateDueLabel.js";
import type { ShortcutBoardScope, ShortcutBoardSnapshot, ShortcutBoardStory } from "./types.js";
import type { WorkspaceLayout } from "./workspaceLayout.js";
import { useAdaptiveRefresh } from './useAdaptiveRefresh.js';

const SCOPE_STORAGE_KEY = "todo-trackr.shortcut-board.scope";

const scopeLabels: Record<ShortcutBoardScope, string> = {
  owner: "Owner",
  requester: "Requester",
  both: "Owner and requester",
  either: "Owner or requester",
};

function readScope(): ShortcutBoardScope {
  const value = window.localStorage.getItem(SCOPE_STORAGE_KEY);
  return value === "owner" || value === "requester" || value === "both" || value === "either"
    ? value
    : "either";
}

function LinkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 7H6a4 4 0 0 0 0 8h3M15 7h3a4 4 0 0 1 0 8h-3M8 11h8v2H8z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    </svg>
  );
}

function dueLabel(story: ShortcutBoardStory): string {
  if (!story.dueDate) return "N/A";
  const [year, month, day] = story.dueDate.split("-").map(Number);
  return shortcutDueDateLabel(new Date(year, month - 1, day));
}

function relationshipLabel(story: ShortcutBoardStory): string {
  if (story.matchesOwner && story.matchesRequester) return "Owner + requester";
  return story.matchesOwner ? "Owner" : "Requester";
}

function ShortcutStoryRow({ story, selected, onSelect, onToggleStar }: {
  story: ShortcutBoardStory;
  selected: boolean;
  onSelect: () => void;
  onToggleStar: () => void;
}) {
  return (
    <div className={`task-row shortcut-board-row has-source-reference ${selected ? "is-selected" : ""}`}>
      <div className="task-row-leading">
        <a
          aria-label={`Open SC-${story.externalReference} in Shortcut`}
          className="task-source-indicator"
          href={story.sourceUrl}
          rel="noreferrer"
          target="_blank"
          title={`Open SC-${story.externalReference} in Shortcut`}
        ><LinkIcon /></a>
        <span className="task-source-reference">{story.externalReference}</span>
      </div>
      <button className="task-summary" onClick={onSelect} type="button">
        <span className="task-title">
          {story.title}
        </span>
      </button>
      <div className="task-row-actions">
        <button
          aria-label={story.isStarred ? `Remove ${story.title} from Starred` : `Add ${story.title} to Starred`}
          aria-pressed={story.isStarred}
          className={`task-star ${story.isStarred ? "is-starred" : ""}`}
          onClick={onToggleStar}
          title={story.isStarred ? "Remove from Starred" : "Add to Starred"}
          type="button"
        ><StarIcon /></button>
      </div>
      <div className="task-meta">
        <span
          aria-label={`Shortcut${story.epicName ? ` Epic ${story.epicName}` : ""}`}
          className={`source-badge ${story.epicName ? "" : "is-icon-only"}`}
          title={`Shortcut${story.epicName ? ` · ${story.epicName}` : ""}`}
        >
          <LinkIcon />
          {story.epicName}
        </span>
        <span className={`priority-label priority-${story.priority}`}>
          <span className="priority-dot" />
          {story.priority === "none" ? "No priority" : story.priority}
        </span>
        <span>{relationshipLabel(story)}</span>
        {story.size ? <span>Size {story.size}</span> : null}
        <ShortcutStateDueLabel workflowStateName={story.workflowStateName} dueDateLabel={dueLabel(story)} />
      </div>
    </div>
  );
}

function ShortcutStoryDetail({ story, compact, onClose, onToggleStar }: {
  story: ShortcutBoardStory;
  compact: boolean;
  onClose: () => void;
  onToggleStar: () => void;
}) {
  return (
    <aside className="detail-panel shortcut-board-detail">
      <div className="detail-heading">
        {compact ? <button className="compact-detail-back" onClick={onClose} type="button">← <span>Back to Shortcut</span></button> : <p className="eyebrow">Shortcut Story</p>}
        <div className="detail-actions">
          <button
            aria-label={story.isStarred ? "Remove from Starred" : "Add to Starred"}
            aria-pressed={story.isStarred}
            className={`icon-button detail-star ${story.isStarred ? "is-starred" : ""}`}
            onClick={onToggleStar}
            type="button"
          ><StarIcon /></button>
          {!compact ? <button aria-label="Close Shortcut details" className="icon-button detail-close" onClick={onClose} type="button">×</button> : null}
        </div>
      </div>
      <h2>{story.title}</h2>
      <div className="source-link-field">
        <label>Source</label>
        <a href={story.sourceUrl} rel="noreferrer" target="_blank">Open SC-{story.externalReference}</a>
      </div>
      <div className="source-facts shortcut-board-facts">
        <ShortcutStateDueLabel workflowStateName={story.workflowStateName} dueDateLabel={dueLabel(story)} />
        <span>{relationshipLabel(story)}</span>
        <span>{story.priority === "none" ? "No priority" : `${story.priority[0].toUpperCase()}${story.priority.slice(1)} priority`}</span>
        {story.size ? <span>Size {story.size}</span> : null}
      </div>
      <p className="shortcut-board-readonly">Read-only from Shortcut. Todo Trackr never changes this Story.</p>
    </aside>
  );
}

export function ShortcutBoardView({ workspaceLayout, onToggleLayout, onShowTasks }: {
  workspaceLayout: WorkspaceLayout;
  onToggleLayout?: () => void;
  onShowTasks: () => void;
}) {
  const [board, setBoard] = useState<ShortcutBoardSnapshot>();
  const [scope, setScope] = useState<ShortcutBoardScope>(readScope);
  const [search, setSearch] = useState("");
  const [selectedReference, setSelectedReference] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  async function load() {
    try {
      setError(undefined);
      const next = await api.shortcutBoard();
      setBoard(next);
      return next;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load Shortcut Board.");
      throw caught;
    } finally {
      setLoading(false);
    }
  }
  useAdaptiveRefresh(load);

  const visibleStories = useMemo(
    () => queryShortcutBoard(board?.stories ?? [], scope, search),
    [board?.stories, scope, search],
  );
  const sections = useMemo(() => shortcutBoardSections(visibleStories), [visibleStories]);
  const selectedStory = board?.stories.find(({ externalReference }) => externalReference === selectedReference);

  function changeScope(next: ShortcutBoardScope) {
    setScope(next);
    window.localStorage.setItem(SCOPE_STORAGE_KEY, next);
    setSelectedReference(undefined);
  }

  async function toggleStar(story: ShortcutBoardStory) {
    const isStarred = !story.isStarred;
    setBoard((current) => current ? {
      ...current,
      stories: current.stories.map((item) => item.externalReference === story.externalReference ? { ...item, isStarred } : item),
    } : current);
    try {
      await api.setShortcutBoardStar(story.externalReference, isStarred);
    } catch (caught) {
      setBoard((current) => current ? {
        ...current,
        stories: current.stories.map((item) => item.externalReference === story.externalReference ? story : item),
      } : current);
      setError(caught instanceof Error ? caught.message : "Unable to update the Shortcut star.");
    }
  }

  return (
    <>
      <section className="task-panel shortcut-board-panel">
        <header>
          <div className="task-heading">
            <p className="eyebrow">Live source workspace</p>
            <h1>Shortcut</h1>
          </div>
          <div className="task-header-meta">
            <span className="task-count">{visibleStories.length} {visibleStories.length === 1 ? "story" : "stories"}</span>
            <button className="layout-toggle workspace-mode-toggle" onClick={onShowTasks} type="button">✓ <span>Tasks</span></button>
            {onToggleLayout ? (
              <button className="layout-toggle workspace-layout-toggle" onClick={onToggleLayout} type="button"><span>{workspaceLayout === "compact" ? "Standard" : "Compact"}</span></button>
            ) : null}
          </div>
        </header>
        <div className="shortcut-board-toolbar">
          <div className="shortcut-scope-switch" role="group" aria-label="Shortcut personal scope">
            {(Object.keys(scopeLabels) as ShortcutBoardScope[]).map((item) => (
              <button
                aria-pressed={scope === item}
                className={scope === item ? "is-active" : ""}
                key={item}
                onClick={() => changeScope(item)}
                type="button"
              >{scopeLabels[item]}</button>
            ))}
          </div>
          <input aria-label="Search Shortcut Stories" onChange={(event) => setSearch(event.target.value)} placeholder="Search Shortcut" type="search" value={search} />
        </div>
        {error ? <p className="banner-error" role="alert">{error}<button onClick={() => setError(undefined)} type="button">Dismiss</button></p> : null}
        <div className="task-list">
          {loading ? <p className="empty-state">Loading Shortcut…</p> : null}
          {!loading && visibleStories.length === 0 ? <p className="empty-state">No active Shortcut Stories match this scope.</p> : null}
          {sections.map((section) => (
            <section className="task-section" key={section.id}>
              <div className={`task-section-heading${section.id === "overdue" || section.id === "today" ? ` is-${section.id}` : ""}`}>
                <h2>{section.label}</h2><span>{section.stories.length}</span>
              </div>
              {section.stories.map((story) => (
                <ShortcutStoryRow
                  key={story.externalReference}
                  onSelect={() => setSelectedReference(story.externalReference)}
                  onToggleStar={() => void toggleStar(story)}
                  selected={selectedReference === story.externalReference}
                  story={story}
                />
              ))}
            </section>
          ))}
        </div>
      </section>
      <div className={`detail-overlay ${selectedStory ? "is-open" : ""}`}>
        {selectedStory ? (
          <ShortcutStoryDetail
            compact={workspaceLayout === "compact"}
            onClose={() => setSelectedReference(undefined)}
            onToggleStar={() => void toggleStar(selectedStory)}
            story={selectedStory}
          />
        ) : (
          <aside className="detail-panel empty-detail"><span className="app-mark muted"><LinkIcon /></span><p>Select a Shortcut Story to view its details.</p></aside>
        )}
      </div>
    </>
  );
}

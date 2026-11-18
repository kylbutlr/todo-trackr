import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { api } from "./api";
import type { BackupImportResult, DeletedTask, SystemHealth } from "./types";

function displayTime(value: string | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function shortCommit(value: string | null | undefined): string {
  return value?.slice(0, 8) ?? "Local or unavailable";
}

export function SystemHealthView({ onHealthChanged, onTasksChanged }: {
  onHealthChanged: (health: SystemHealth) => void;
  onTasksChanged: () => void;
}) {
  const [health, setHealth] = useState<SystemHealth>();
  const [deletedTasks, setDeletedTasks] = useState<DeletedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<BackupImportResult>();
  const fileInput = useRef<HTMLInputElement>(null);

  async function refresh() {
    setError(undefined);
    const nextHealth = await api.systemHealth();
    const nextDeletedTasks = nextHealth.schema.current ? await api.deletedTasks() : [];
    setHealth(nextHealth);
    onHealthChanged(nextHealth);
    setDeletedTasks(nextDeletedTasks);
  }

  useEffect(() => {
    void refresh()
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load system health."))
      .finally(() => setLoading(false));
  }, []);

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setRecovering(true);
    setError(undefined);
    setResult(undefined);
    try {
      const backup = JSON.parse(await file.text()) as unknown;
      const nextResult = await api.importBackup(backup);
      setResult(nextResult);
      await refresh();
      onTasksChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to import this backup.");
    } finally {
      setRecovering(false);
    }
  }

  async function restoreTask(task: DeletedTask) {
    setRecovering(true);
    setError(undefined);
    try {
      await api.restoreDeletedTask(task.id);
      setDeletedTasks((current) => current.filter((item) => item.id !== task.id));
      onTasksChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to restore this Task.");
    } finally {
      setRecovering(false);
    }
  }

  const environment = health
    ? [...Object.entries(health.environment.required), ...Object.entries(health.environment.optional)]
    : [];

  return (
    <section className="connection-preview system-health-view">
      <header className="connection-heading">
        <div>
                    <h1>System health</h1>
          <p className="connection-copy">One private view for deployment, database, connection, and recovery readiness. Secret values are never returned.</p>
        </div>
        <div className="connection-actions">
          <button className="secondary-button" disabled={loading} onClick={() => void refresh()} type="button">Refresh</button>
        </div>
      </header>

      {error ? <p className="banner-error" role="alert">{error}</p> : null}
      {result ? <p className="banner-success" role="status">Restored {result.restoredTasks} Tasks and {result.restoredLists} lists. Skipped {result.skippedTasks} existing or source-managed Tasks.</p> : null}

      <div className="health-overview" aria-label="System readiness">
        <article>
          <span>Overall</span>
          <strong className={`health-label is-${health?.status ?? "attention"}`}>{loading ? "Checking" : health?.status ?? "Unavailable"}</strong>
          <small>Generated {displayTime(health?.generatedAt ?? null)}</small>
        </article>
        <article>
          <span>Database</span>
          <strong>{health?.schema.currentVersion ?? "Not tracked"} / {health?.schema.requiredVersion ?? 13}</strong>
          <small>{health?.schema.message ?? "Checking schema ledger."}</small>
        </article>
        <article>
          <span>Web client version</span>
          <strong>v{health?.deployment.webVersion ?? "unknown"}</strong>
          <small>{shortCommit(health?.deployment.commitRef)} · {health?.deployment.context ?? "local"}</small>
        </article>
        <article>
          <span>Mac source version</span>
          <strong>v{health?.deployment.sparkleVersion ?? "unknown"}</strong>
          <small>Build {health?.deployment.sparkleBuild ?? "unknown"}</small>
        </article>
      </div>

      <div className="health-columns">
        <section className="health-section">
          <div className="history-heading"><h2>Connections</h2><span>Latest observed state</span></div>
          {health?.connections.length === 0 ? <p>No integrations are enabled for this installation.</p> : null}
          {health?.connections.map((connection) => (
            <article className="health-row" key={connection.source}>
              <span className={`health-dot is-${connection.health}`} aria-hidden="true" />
              <div><strong>{connection.name}</strong><p>{connection.lastFailureMessage ?? (connection.paused ? "Paused" : `Scheduler ${connection.schedulerFreshness} · last success ${displayTime(connection.lastSuccessAt)}`)}</p></div>
              <time dateTime={connection.latestRunAt ?? undefined}>{displayTime(connection.latestRunAt)}</time>
            </article>
          ))}
        </section>

        <section className="health-section">
          <div className="history-heading"><h2>Environment</h2><span>Presence only</span></div>
          <div className="environment-grid">
            {environment.map(([name, configured]) => (
              <div key={name}><code>{name}</code><span className={configured ? "is-configured" : "is-missing"}>{configured ? "Configured" : "Missing"}</span></div>
            ))}
          </div>
        </section>
      </div>

      <section className="health-section recovery-section">
        <div className="history-heading"><h2>JSON backup and recovery</h2><span>Only missing data is restored</span></div>
        <p>Exports include lists, active Tasks, and recoverable deleted Tasks. Imports never overwrite an existing Task and skip Shortcut-managed records.</p>
        <div className="recovery-actions">
          <a className="primary-button" download href="/api/recovery/export">Download JSON backup</a>
          <button className="secondary-button" disabled={recovering} onClick={() => fileInput.current?.click()} type="button">Import JSON backup</button>
          <input accept="application/json,.json" className="visually-hidden" onChange={(event) => void importBackup(event)} ref={fileInput} type="file" />
        </div>
        <div className="deleted-task-list">
          <div className="history-heading"><h3>Recently deleted</h3><span>{deletedTasks.length}</span></div>
          {deletedTasks.length === 0 ? <p className="history-empty">No recoverable deletions.</p> : null}
          {deletedTasks.map((task) => (
            <article className="deleted-task-row" key={task.id}>
              <div><strong>{task.title}</strong><p>{task.source} · deleted {displayTime(task.deletedAt)}</p></div>
              <button className="secondary-button" disabled={recovering} onClick={() => void restoreTask(task)} type="button">Restore</button>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

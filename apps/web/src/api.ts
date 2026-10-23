import type { ShortcutWorkflowSettings, BackupImportResult, CodexDiagnostics, CodexSession, CreateTaskInput, DeletedTask, GranolaBackfillResult, GranolaDiagnostics, ShortcutAutomationActivity, ShortcutBoardSnapshot, ShortcutConnection, ShortcutConnectionControlMode, ShortcutDiagnostics, ShortcutImportResult, ShortcutPreview, ShortcutReconcileResult, ShortcutRuleV2Shadow, SystemHealth, Task, TaskList, UpdateTaskInput } from "./types.js";
import { legacyInstallation, parseInstallation, type Installation } from "./installation.js";

type ErrorPayload = {
  error?: string;
  code?: string;
  currentTask?: Task;
};

export class APIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly currentTask?: Task,
  ) {
    super(message);
    this.name = "APIError";
  }
}

let sessionExpiredHandler: (() => void) | undefined;

export function onSessionExpired(handler: () => void) {
  sessionExpiredHandler = handler;
  return () => {
    if (sessionExpiredHandler === handler) sessionExpiredHandler = undefined;
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: init?.cache ?? "no-store",
    credentials: "same-origin",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ErrorPayload;
    if (response.status === 401 && path !== "/api/auth/login" && path !== "/api/auth/session") sessionExpiredHandler?.();
    throw new APIError(payload.error ?? "Request failed.", response.status, payload.code, payload.currentTask);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function isAtomicUpdate(input: UpdateTaskInput): boolean {
  const fields = Object.keys(input);
  return fields.length === 1 && (fields[0] === "status" || fields[0] === "isStarred");
}

async function patchTask(task: Task, input: UpdateTaskInput): Promise<Task> {
  const payload = await request<{ task: Task }>(`/api/tasks/${task.id}`, {
    method: "PATCH",
    body: JSON.stringify({ ...input, expectedUpdatedAt: task.updateToken ?? task.updatedAt }),
  });
  return payload.task;
}

export const api = {
  async installation(): Promise<Installation> {
    try { return parseInstallation(await request("/api/installation")); }
    catch (error) {
      if (error instanceof APIError && error.status === 404) return legacyInstallation;
      throw error;
    }
  },
  async session(): Promise<boolean> {
    try {
      await request<{ authenticated: true }>("/api/auth/session");
      return true;
    } catch (error) {
      if (error instanceof APIError && error.status === 401) {
        return false;
      }

      throw error;
    }
  },

  login(password: string): Promise<{ authenticated: true }> {
    return request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password, client: "web" }),
    });
  },

  logout(): Promise<void> {
    return request("/api/auth/logout", { method: "POST" });
  },

  async tasks(): Promise<Task[]> {
    const payload = await request<{ tasks: Task[] }>("/api/tasks", { cache: "no-cache" });
    return payload.tasks;
  },

  async systemHealth(): Promise<SystemHealth> {
    const payload = await request<{ health: SystemHealth }>("/api/system/health");
    return payload.health;
  },

  async deletedTasks(): Promise<DeletedTask[]> {
    const payload = await request<{ tasks: DeletedTask[] }>("/api/recovery/deleted");
    return payload.tasks;
  },

  async restoreDeletedTask(id: string): Promise<void> {
    return request(`/api/recovery/deleted/${id}/restore`, { method: "POST" });
  },

  async importBackup(backup: unknown): Promise<BackupImportResult> {
    const payload = await request<{ result: BackupImportResult }>("/api/recovery/import", {
      method: "POST",
      body: JSON.stringify(backup),
    });
    return payload.result;
  },

  async taskActivity(taskId: string): Promise<ShortcutAutomationActivity[]> {
    const payload = await request<{ activity: ShortcutAutomationActivity[] }>(`/api/tasks/${taskId}/activity`);
    return payload.activity;
  },

  async taskCodexSessions(taskId: string): Promise<CodexSession[]> {
    const payload = await request<{ sessions: CodexSession[] }>(`/api/tasks/${taskId}/codex-sessions`);
    return payload.sessions;
  },

  async attachCodexSession(taskId: string, reference: string): Promise<CodexSession> {
    const payload = await request<{ session: CodexSession }>(`/api/tasks/${taskId}/codex-sessions`, {
      method: "POST",
      body: JSON.stringify({ reference }),
    });
    return payload.session;
  },

  async detachCodexSession(id: string): Promise<void> {
    return request(`/api/codex-sessions/${id}`, { method: "DELETE" });
  },

  async lists(): Promise<TaskList[]> {
    const payload = await request<{ lists: TaskList[] }>("/api/lists");
    return payload.lists;
  },

  async createList(name: string): Promise<TaskList> {
    const payload = await request<{ list: TaskList }>("/api/lists", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    return payload.list;
  },

  async shortcutWorkflowSettings(): Promise<ShortcutWorkflowSettings> {
    const payload = await request<{ settings: ShortcutWorkflowSettings }>("/api/connections/shortcut/workflow-settings");
    return payload.settings;
  },

  async saveShortcutWorkflowSettings(expectedVersion: number, activeStateIds: number[]): Promise<ShortcutWorkflowSettings> {
    const payload = await request<{ settings: ShortcutWorkflowSettings }>("/api/connections/shortcut/workflow-settings", {
      method: "PATCH", body: JSON.stringify({ expectedVersion, activeStateIds }),
    });
    return payload.settings;
  },

  async shortcutPreview(): Promise<ShortcutPreview> {
    const payload = await request<{ preview: ShortcutPreview }>("/api/connections/shortcut/preview", {
      method: "POST",
    });
    return payload.preview;
  },

  async shortcutConnection(): Promise<ShortcutConnection> {
    const payload = await request<{ connection: ShortcutConnection }>("/api/connections/shortcut");
    return payload.connection;
  },

  async shortcutBoard(): Promise<ShortcutBoardSnapshot> {
    const payload = await request<{ board: ShortcutBoardSnapshot }>("/api/shortcut-board");
    return payload.board;
  },

  async setShortcutBoardStar(externalReference: string, isStarred: boolean): Promise<void> {
    await request(`/api/shortcut-board/${encodeURIComponent(externalReference)}`, {
      method: "PATCH",
      body: JSON.stringify({ isStarred }),
    });
  },

  async shortcutDiagnostics(): Promise<ShortcutDiagnostics> {
    const payload = await request<{ diagnostics: ShortcutDiagnostics }>("/api/connections/shortcut/diagnostics");
    return payload.diagnostics;
  },

  async shortcutRuleV2Shadow(refresh = false): Promise<ShortcutRuleV2Shadow> {
    const payload = await request<{ shadow: ShortcutRuleV2Shadow }>("/api/connections/shortcut/rule-v2-shadow", {
      method: refresh ? "POST" : "GET",
    });
    return payload.shadow;
  },

  async granolaDiagnostics(): Promise<GranolaDiagnostics> {
    const payload = await request<{ diagnostics: GranolaDiagnostics }>("/api/connections/granola/diagnostics");
    return payload.diagnostics;
  },

  async updateGranolaSchedule(scanIntervalMinutes: number, scanOffsetMinutes: number): Promise<GranolaDiagnostics> {
    const payload = await request<{ diagnostics: GranolaDiagnostics }>("/api/connections/granola/schedule", {
      method: "PATCH",
      body: JSON.stringify({ scanIntervalMinutes, scanOffsetMinutes }),
    });
    return payload.diagnostics;
  },

  async codexDiagnostics(): Promise<CodexDiagnostics> {
    const payload = await request<{ diagnostics: CodexDiagnostics }>("/api/connections/codex/diagnostics");
    return payload.diagnostics;
  },

  async backfillGranola(days = 7): Promise<GranolaBackfillResult> {
    const payload = await request<{ result: GranolaBackfillResult }>("/api/connections/granola/backfill", {
      method: "POST",
      body: JSON.stringify({ days }),
    });
    return payload.result;
  },

  async acceptGranolaReviewCandidate(id: string): Promise<GranolaDiagnostics> {
    const payload = await request<{ diagnostics: GranolaDiagnostics }>(`/api/connections/granola/review/${encodeURIComponent(id)}/accept`, {
      method: "POST",
    });
    return payload.diagnostics;
  },

  async dismissGranolaReviewCandidate(id: string): Promise<GranolaDiagnostics> {
    const payload = await request<{ diagnostics: GranolaDiagnostics }>(`/api/connections/granola/review/${encodeURIComponent(id)}/dismiss`, {
      method: "POST",
    });
    return payload.diagnostics;
  },

  async pushConfiguration(): Promise<{ configured: boolean; publicKey: string | null }> {
    return request("/api/notifications/config");
  },

  savePushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
    return request("/api/notifications/subscriptions", {
      method: "POST",
      body: JSON.stringify(subscription),
    });
  },

  removePushSubscription(endpoint: string): Promise<void> {
    return request("/api/notifications/subscriptions", {
      method: "DELETE",
      body: JSON.stringify({ endpoint }),
    });
  },

  async updateShortcutConnectionMode(mode: ShortcutConnectionControlMode): Promise<ShortcutConnection> {
    const payload = await request<{ connection: ShortcutConnection }>("/api/connections/shortcut", {
      method: "PATCH",
      body: JSON.stringify({ mode }),
    });
    return payload.connection;
  },

  async syncShortcutNow(): Promise<{ outcome: "applied" | "ignored"; applied: number }> {
    const payload = await request<{ result: { outcome: "applied" | "ignored"; applied: number } }>("/api/connections/shortcut/sync", {
      method: "POST",
    });
    return payload.result;
  },

  async importShortcutTasks(approvalToken: string): Promise<ShortcutImportResult> {
    const payload = await request<{ result: ShortcutImportResult }>("/api/connections/shortcut/import", {
      method: "POST",
      body: JSON.stringify({ approvalToken }),
    });
    return payload.result;
  },

  async applyShortcutChanges(approvalToken: string): Promise<ShortcutReconcileResult> {
    const payload = await request<{ result: ShortcutReconcileResult }>("/api/connections/shortcut/apply", {
      method: "POST",
      body: JSON.stringify({ approvalToken }),
    });
    return payload.result;
  },

  async createTask(input: CreateTaskInput): Promise<Task> {
    const payload = await request<{ task: Task }>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return payload.task;
  },

  async updateTask(task: Task, input: UpdateTaskInput): Promise<Task> {
    try {
      return await patchTask(task, input);
    } catch (error) {
      if (
        isAtomicUpdate(input)
        && error instanceof APIError
        && error.code === "TASK_CONFLICT"
        && error.currentTask?.id === task.id
      ) {
        return patchTask(error.currentTask, input);
      }
      throw error;
    }
  },

  deleteTask(id: string): Promise<void> {
    return request(`/api/tasks/${id}`, { method: "DELETE" });
  },
};

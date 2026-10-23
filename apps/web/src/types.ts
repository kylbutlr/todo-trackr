export type TaskStatus = "open" | "completed" | "archived";
export type TaskPriority = "none" | "lowest" | "low" | "medium" | "high" | "highest";
export type TaskSource = "manual" | "browser" | "shortcut" | "granola" | "slack" | "gmail";

export type TaskList = {
  id: string;
  name: string;
  sortOrder: number;
  isInbox: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  updateToken?: string;
  completedAt: string | null;
  archivedAt: string | null;
  isStarred: boolean;
  alarmAt?: string | null;
  alarmNotifiedAt?: string | null;
  alarmClearedAt?: string | null;
  needsAttention?: boolean;
  listId: string;
  source: TaskSource;
  sourceUrl: string | null;
  sourceDetails: {
    externalReference: string;
    summary: string | null;
    size: "S" | "M" | "L" | "XL" | null;
    workflowStateName: string | null;
    epicName?: string | null;
  } | null;
};

export type CreateTaskInput = {
  title: string;
  notes?: string;
  priority?: TaskPriority;
  dueAt?: string | null;
  listId?: string;
  source?: "manual" | "browser" | "slack";
  sourceUrl?: string | null;
};

export type UpdateTaskInput = Partial<
  Pick<Task, "title" | "notes" | "priority" | "dueAt" | "sortOrder" | "listId" | "isStarred" | "alarmAt">
> & {
  status?: "open" | "completed";
  clearAlarm?: boolean;
};

export type ConnectionHealth = "healthy" | "syncing" | "degraded" | "failed" | "paused";
export type ShortcutSyncMode = "review" | "automatic";
export type ShortcutConnectionControlMode = "off" | ShortcutSyncMode;
export type ShortcutConnection = {
  id: string;
  name: string;
  paused: boolean;
  syncMode: ShortcutSyncMode;
  controlMode: ShortcutConnectionControlMode;
  health: ConnectionHealth;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
  lastWebhookAt: string | null;
  lastFullSyncAt: string | null;
  nextRepairAt: string | null;
  repairIntervalSeconds: number;
};
export type ShortcutSyncRun = {
  id: string;
  trigger: "manual" | "webhook" | "poll" | "scheduled" | "resume" | "rule_change";
  status: "running" | "succeeded" | "failed";
  counts: Record<string, number>;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
};
export type ShortcutAutomationActivity = {
  id: string;
  taskId: string;
  taskTitle: string;
  externalReference: string | null;
  action: "created" | "updated" | "completed" | "reopened" | "archived";
  reason: string;
  ruleVersion: number;
  sourceObservation: Record<string, unknown>;
  createdAt: string;
};
export type ShortcutDiagnostics = {
  connection: ShortcutConnection;
  syncRuns: ShortcutSyncRun[];
  activity: ShortcutAutomationActivity[];
};

export type GranolaConnection = {
  id: string;
  name: string;
  health: ConnectionHealth;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
  nextScanAt: string;
  scanIntervalSeconds: number;
  scanIntervalMinutes: number;
  scanOffsetMinutes: number;
};
export type GranolaWebhookEvent = {
  id: string;
  status: "processing" | "succeeded" | "ignored" | "failed";
  noteId: string | null;
  detail: string | null;
  receivedAt: string;
  processedAt: string | null;
};
export type GranolaReviewCandidate = {
  id: string;
  title: string;
  sourceUrl: string;
  sourceExcerpt: string;
  sourceUpdatedAt: string | null;
  status: "pending" | "accepted" | "dismissed" | "stale";
  lastSeenAt: string;
};
export type GranolaSyncRun = {
  id: string;
  trigger: "manual" | "webhook" | "scheduled";
  status: "running" | "succeeded" | "failed";
  counts: Record<string, number>;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
};
export type GranolaDiagnostics = {
  connection: GranolaConnection;
  events: GranolaWebhookEvent[];
  pendingReviewCount: number;
  reviewCandidates: GranolaReviewCandidate[];
  syncRuns: GranolaSyncRun[];
};
export type GranolaBackfillResult = {
  notesScanned: number;
  explicitActions: number;
  reviewCandidates: number;
  created: number;
  skipped: number;
};

export type CodexSessionStatus = "linked" | "queued" | "working" | "waiting_for_you" | "ready_for_review" | "failed" | "finished";
export type CodexSession = {
  id: string;
  taskId: string;
  taskTitle: string;
  threadId: string;
  threadUrl: string | null;
  title: string | null;
  status: CodexSessionStatus;
  latestSummary: string | null;
  cwd: string | null;
  branchName: string | null;
  prUrl: string | null;
  isCurrent: boolean;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
};
export type CodexDiagnostics = {
  connection: {
    id: string;
    name: string;
    health: ConnectionHealth;
    lastSuccessAt: string | null;
  };
  counts: Record<CodexSessionStatus, number>;
  sessions: CodexSession[];
};
export type ShortcutPreviewAction = "create" | "update" | "complete" | "reopen" | "archive" | "ignore";

export type ShortcutPreviewItem = {
  externalReference: string;
  sourceUrl: string;
  title: string;
  priority: "none" | "lowest" | "low" | "medium" | "high" | "highest";
  size: "S" | "M" | "L" | "XL" | null;
  dueDate: string | null;
  workflowStateName: string;
  action: ShortcutPreviewAction;
  reason: string;
  sourceSummary: string | null;
};

export type ShortcutPreview = {
  mode: "preview";
  generatedAt: string;
  connection: ShortcutConnection;
  rule: {
    id: string;
    version: number;
    name: string;
    activeStates: Record<string, string>;
    completionStates: Record<string, string>;
  };
  counts: Record<ShortcutPreviewAction, number>;
  items: ShortcutPreviewItem[];
  evaluatedCount: number;
  initialImport: {
    allowed: boolean;
    approvalToken: string | null;
  };
  approval: {
    allowed: boolean;
    token: string | null;
  };
};

export type ShortcutRuleV2Reason = {
  id: string;
  kind: "assigned" | "requester" | "description_request" | "comment_request";
  label: string;
  active: boolean;
  userCompletable: boolean;
  sourceExcerpt: string | null;
  sourceUrl: string;
  completionSignal: string | null;
};

export type ShortcutRuleV2ShadowItem = {
  externalReference: string;
  sourceUrl: string;
  title: string;
  workflowStateName: string;
  outcome: "open" | "hold" | "complete" | "ignore";
  salience: "primary" | "heads_up" | "background";
  reasons: ShortcutRuleV2Reason[];
  reasonSummary: string;
  sourceUpdatedAt: string | null;
  fingerprint: string;
  observedAt: string;
};

export type ShortcutRuleV2Shadow = {
  mode: "shadow";
  ruleVersion: 2;
  generatedAt: string;
  coverageStartedAt: string | null;
  mutatesTasks: false;
  counts: Record<"open" | "hold" | "complete" | "ignore" | "primary" | "heads_up" | "background", number>;
  items: ShortcutRuleV2ShadowItem[];
};

export type ShortcutImportResult = {
  imported: number;
  connectionPaused: boolean;
};

export type ShortcutReconcileResult = {
  applied: number;
  counts: Record<Exclude<ShortcutPreviewAction, "ignore">, number>;
  connectionPaused: boolean;
};

export type ShortcutBoardScope = "owner" | "requester" | "both" | "either";
export type ShortcutBoardStory = {
  externalReference: string;
  sourceUrl: string;
  title: string;
  priority: TaskPriority;
  size: "S" | "M" | "L" | "XL" | null;
  dueDate: string | null;
  workflowStateName: string;
  ownerIds: string[];
  requestedById: string | null;
  matchesOwner: boolean;
  matchesRequester: boolean;
  isStarred: boolean;
  sourceUpdatedAt: string | null;
  epicName?: string | null;
};
export type ShortcutBoardSnapshot = {
  generatedAt: string;
  memberId: string;
  stories: ShortcutBoardStory[];
};

export type SystemHealth = {
  generatedAt: string;
  status: "healthy" | "attention";
  schema: {
    currentVersion: number | null;
    requiredVersion: number;
    current: boolean;
    appliedAt: string | null;
    message: string;
  };
  environment: {
    required: Record<string, boolean>;
    optional: Record<string, boolean>;
    requiredConfigured: boolean;
  };
  deployment: {
    webVersion: string;
    sparkleVersion: string;
    sparkleBuild: string;
    commitRef: string | null;
    deployId: string | null;
    context: string | null;
  };
  connections: Array<{
    source: string;
    name: string;
    paused: boolean;
    health: ConnectionHealth;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    lastFailureMessage: string | null;
    latestRunAt: string | null;
    latestRunStatus: "running" | "succeeded" | "failed" | null;
    schedulerFreshness: "fresh" | "stale" | "not_applicable" | "unknown";
    expectedWithinMinutes: number | null;
  }>;
};

export type DeletedTask = {
  id: string;
  title: string;
  source: TaskSource;
  deletedAt: string;
};

export type BackupImportResult = {
  runId: string;
  mode: "only_missing";
  restoredLists: number;
  restoredTasks: number;
  skippedTasks: number;
};

export type ShortcutWorkflowSettings = {
  version: number;
  activeStates: Record<string, string>;
  completionStates: Record<string, string>;
  availableStates: Array<{ id: number; name: string; type: "backlog" | "unstarted" | "started" | "done"; workflowName: string }>;
};

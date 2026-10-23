import { createHash } from "node:crypto";
import { assertBrowserOrigin, assertIntegrationRoute, authenticationMode, installationCapabilities, isStandalone, publicOrigin } from "./lib/installation.js";
import { deferWorkEvent } from "./lib/work-inbox.js";
import { clientWorkPermission } from "./lib/work-resume.js";
import type { Config } from "@netlify/functions";
import { z } from "zod";

import {
  assertLoginAllowed,
  clearFailedLogins,
  createSessionToken,
  expiredSessionCookie,
  recordFailedLogin,
  requireSession,
  sessionCookie,
  verifyPassword,
} from "./lib/auth.js";
import { conditionalJson, HttpError, json, noContent, readJson } from "./lib/http.js";
import {
  pushNotificationConfiguration,
  pushSubscriptionSchema,
  removePushSubscription,
  removePushSubscriptionSchema,
  savePushSubscription,
} from "./lib/push-notifications.js";
import { createListSchema, createTaskList, listTaskLists } from "./lib/lists.js";
import { loadShortcutWorkflowSettings, updateShortcutWorkflowSettings, shortcutSettingsSchema } from "./lib/automation/shortcut-settings.js";
import { buildShortcutPreview } from "./lib/automation/shortcut-preview.js";
import {
  loadShortcutBoard,
  setShortcutBoardStar,
  shortcutBoardStarSchema,
} from "./lib/automation/shortcut-board.js";
import { importInitialShortcutTasks } from "./lib/automation/shortcut-import.js";
import { applyApprovedShortcutChanges } from "./lib/automation/shortcut-reconcile.js";
import { granolaIngestSchema } from "./lib/automation/granola-ingest.js";
import { backfillRecentGranolaNotes } from "./lib/automation/granola-backfill.js";
import {
  acceptGranolaReviewCandidate,
  dismissGranolaReviewCandidate,
  GRANOLA_SCAN_INTERVAL_OPTIONS,
  isValidGranolaSchedule,
  loadGranolaDiagnostics,
  queueGranolaActionsForReview,
  updateGranolaScheduleSettings,
} from "./lib/automation/granola-repository.js";
import { requireAutomationIngestAuthorization } from "./lib/automation/ingest-auth.js";
import {
  attachCodexSession,
  attachCodexSessionSchema,
  detachCodexSession,
  ingestCodexSession,
  ingestCodexSessionSchema,
  listTaskCodexSessions,
  loadCodexDiagnostics,
  updateCodexSession,
  updateCodexSessionSchema,
} from "./lib/automation/codex-repository.js";
import { loadShortcutConnection, loadShortcutDiagnostics, loadTaskAutomationActivity } from "./lib/automation/shortcut-repository.js";
import { refreshShortcutRuleV2Shadow } from "./lib/automation/shortcut-rule-v2-shadow.js";
import { loadShortcutRuleV2Shadow } from "./lib/automation/shortcut-shadow-repository.js";
import {
  runAutomaticShortcutSync,
  setShortcutConnectionControlMode,
} from "./lib/automation/shortcut-sync.js";
import {
  createTask,
  createTaskSchema,
  deleteTask,
  listTasks,
  updateTask,
  updateTaskSchema,
} from "./lib/tasks.js";
import { requireEnvironment } from "./lib/config.js";
import { loadSystemHealth } from "./lib/system-health.js";
import { loadReviewSummary } from "./lib/review-summary.js";
import { processTaskAlarm } from "./lib/task-alarms.js";
import {
  backupImportSchema,
  createJsonBackup,
  importJsonBackup,
  listDeletedTasks,
  restoreDeletedTask,
} from "./lib/recovery.js";

const loginSchema = z.object({
  password: z.string().min(1).max(1_000),
  client: z.enum(["web", "macos", "extension"]).default("web"),
});

const shortcutImportSchema = z.object({
  approvalToken: z.string().regex(/^[a-f0-9]{64}$/u),
});

const shortcutConnectionModeSchema = z.object({
  mode: z.enum(["off", "review", "automatic"]),
});

const granolaBackfillSchema = z.object({
  days: z.number().int().min(1).max(30).default(7),
});

const granolaScheduleSchema = z.object({
  scanIntervalMinutes: z.number().int().refine(
    (value) => GRANOLA_SCAN_INTERVAL_OPTIONS.includes(value as typeof GRANOLA_SCAN_INTERVAL_OPTIONS[number]),
    "Granola scan interval must be 5, 10, 15, 30, or 60 minutes.",
  ),
  scanOffsetMinutes: z.number().int().min(0).max(55),
}).refine(
  ({ scanIntervalMinutes, scanOffsetMinutes }) => isValidGranolaSchedule(scanIntervalMinutes, scanOffsetMinutes),
  "Granola scan offset must be a five-minute increment within the selected interval.",
);

const taskAlarmDeliverySchema = z.object({
  alarmAt: z.iso.datetime({ offset: true }),
});

function pathFor(request: Request): string {
  const pathname = new URL(request.url).pathname;
  return pathname.replace(/^\/\.netlify\/functions\/api/, "/api");
}

function taskId(pathname: string): string | undefined {
  const match = pathname.match(/^\/api\/tasks\/([0-9a-f-]+)$/i);
  return match?.[1];
}

function taskActivityId(pathname: string): string | undefined {
  const match = pathname.match(/^\/api\/tasks\/([0-9a-f-]+)\/activity$/i);
  return match?.[1];
}

function taskCodexSessionsId(pathname: string): string | undefined {
  const match = pathname.match(/^\/api\/tasks\/([0-9a-f-]+)\/codex-sessions$/i);
  return match?.[1];
}

function codexSessionId(pathname: string): string | undefined {
  const match = pathname.match(/^\/api\/codex-sessions\/([0-9a-f-]+)$/i);
  return match?.[1];
}

function shortcutBoardStoryReference(pathname: string): string | undefined {
  const match = pathname.match(/^\/api\/shortcut-board\/(\d+)$/u);
  return match?.[1];
}

function granolaReviewCandidateId(pathname: string, action: "accept" | "dismiss"): string | undefined {
  const match = pathname.match(new RegExp(`^/api/connections/granola/review/(.+)/${action}$`, "u"));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function deletedTaskId(pathname: string): string | undefined {
  const match = pathname.match(/^\/api\/recovery\/deleted\/([0-9a-f-]+)\/restore$/iu);
  return match?.[1];
}

function taskAlarmDeliveryId(pathname: string): string | undefined {
  const match = pathname.match(/^\/api\/ingest\/task-alarms\/([0-9a-f-]+)$/iu);
  return match?.[1];
}

async function login(request: Request): Promise<Response> {
  if (authenticationMode() === "none") return json({ authenticated: true, authenticationMode: "none" });
  const input = loginSchema.parse(await readJson(request));
  const fingerprint = await assertLoginAllowed(request);

  if (!verifyPassword(input.password)) {
    await recordFailedLogin(fingerprint);
    throw new HttpError(401, "Incorrect password.");
  }

  await clearFailedLogins(fingerprint);
  const token = await createSessionToken();

  if (input.client === "macos" || input.client === "extension") {
    return json({ token });
  }

  return json(
    { authenticated: true },
    { headers: { "set-cookie": sessionCookie(token, !isStandalone() || publicOrigin().protocol === "https:") } },
  );
}

async function route(request: Request): Promise<Response> {
  const pathname = pathFor(request);
  assertBrowserOrigin(request);
  assertIntegrationRoute(pathname);

  if (pathname === "/api/installation" && request.method === "GET") return json(installationCapabilities());

  if (pathname === "/api/auth/login" && request.method === "POST") {
    return login(request);
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    return noContent({ "set-cookie": expiredSessionCookie(!isStandalone() || publicOrigin().protocol === "https:") });
  }

  if (pathname === "/api/auth/session" && request.method === "GET") {
    await requireSession(request);
    return json({ authenticated: true, authenticationMode: authenticationMode() });
  }

  if (pathname === "/api/ingest/granola/actions" && request.method === "POST") {
    requireAutomationIngestAuthorization(request);
    const input = granolaIngestSchema.parse(await readJson(request));
    const eventBody = JSON.stringify(input);
    if (await deferWorkEvent("granola-actions", createHash("sha256").update(eventBody).digest("hex"), eventBody)) {
      return json({ deferred: true }, { status: 202 });
    }
    return json({ result: await queueGranolaActionsForReview(input) }, { status: 202 });
  }

  if (pathname === "/api/ingest/codex/sessions" && request.method === "POST") {
    requireAutomationIngestAuthorization(request);
    const input = ingestCodexSessionSchema.parse(await readJson(request));
    const eventBody = JSON.stringify(input);
    if (await deferWorkEvent("codex", createHash("sha256").update(eventBody).digest("hex"), eventBody)) {
      return json({ deferred: true }, { status: 202 });
    }
    return json({ session: await ingestCodexSession(input) }, { status: 202 });
  }

  const alarmTaskId = taskAlarmDeliveryId(pathname);
  if (alarmTaskId && request.method === "POST") {
    requireAutomationIngestAuthorization(request);
    const input = taskAlarmDeliverySchema.parse(await readJson(request));
    return json({ delivered: await processTaskAlarm(alarmTaskId, input.alarmAt) });
  }

  await requireSession(request);

  if (pathname === "/api/work-state" && request.method === "GET") {
    return json(await clientWorkPermission());
  }

  if (pathname === "/api/system/health" && request.method === "GET") {
    return json({ health: await loadSystemHealth() });
  }

  if (pathname === "/api/review-summary" && request.method === "GET") {
    return json({ summary: await loadReviewSummary() });
  }

  if (pathname === "/api/recovery/export" && request.method === "GET") {
    return json(await createJsonBackup(), {
      headers: { "content-disposition": `attachment; filename="todo-trackr-backup-${new Date().toISOString().slice(0, 10)}.json"` },
    });
  }

  if (pathname === "/api/recovery/import" && request.method === "POST") {
    const input = backupImportSchema.parse(await readJson(request));
    return json({ result: await importJsonBackup(input) });
  }

  if (pathname === "/api/recovery/deleted" && request.method === "GET") {
    return json({ tasks: await listDeletedTasks() });
  }

  const recoveryTaskId = deletedTaskId(pathname);
  if (recoveryTaskId && request.method === "POST") {
    await restoreDeletedTask(recoveryTaskId);
    return noContent();
  }

  if (pathname === "/api/lists" && request.method === "GET") {
    return json({ lists: await listTaskLists() });
  }

  if (pathname === "/api/lists" && request.method === "POST") {
    const input = createListSchema.parse(await readJson(request));
    return json({ list: await createTaskList(input) }, { status: 201 });
  }

  if (pathname === "/api/connections/shortcut/workflow-settings" && request.method === "GET") {
    return json({ settings: await loadShortcutWorkflowSettings() });
  }
  if (pathname === "/api/connections/shortcut/workflow-settings" && request.method === "PATCH") {
    const input = shortcutSettingsSchema.parse(await readJson(request));
    return json({ settings: await updateShortcutWorkflowSettings(input) });
  }

  if (pathname === "/api/connections/shortcut/preview" && request.method === "POST") {
    return json({ preview: await buildShortcutPreview() });
  }

  if (pathname === "/api/shortcut-board" && request.method === "GET") {
    return json({ board: await loadShortcutBoard() });
  }

  const boardStoryReference = shortcutBoardStoryReference(pathname);
  if (boardStoryReference && request.method === "PATCH") {
    const input = shortcutBoardStarSchema.parse(await readJson(request));
    await setShortcutBoardStar(boardStoryReference, input.isStarred);
    return json({ externalReference: boardStoryReference, isStarred: input.isStarred });
  }

  if (pathname === "/api/connections/shortcut" && request.method === "GET") {
    return json({ connection: await loadShortcutConnection() });
  }

  if (pathname === "/api/connections/shortcut/diagnostics" && request.method === "GET") {
    return json({ diagnostics: await loadShortcutDiagnostics() });
  }

  if (pathname === "/api/connections/shortcut/rule-v2-shadow" && request.method === "GET") {
    return json({ shadow: await loadShortcutRuleV2Shadow() });
  }

  if (pathname === "/api/connections/shortcut/rule-v2-shadow" && request.method === "POST") {
    return json({ shadow: await refreshShortcutRuleV2Shadow() });
  }

  if (pathname === "/api/connections/shortcut" && request.method === "PATCH") {
    const input = shortcutConnectionModeSchema.parse(await readJson(request));
    return json({ connection: await setShortcutConnectionControlMode(input.mode) });
  }

  if (pathname === "/api/connections/shortcut/sync" && request.method === "POST") {
    return json({ result: await runAutomaticShortcutSync({ trigger: "manual" }) });
  }

  if (pathname === "/api/connections/shortcut/import" && request.method === "POST") {
    const input = shortcutImportSchema.parse(await readJson(request));
    return json({ result: await importInitialShortcutTasks(input.approvalToken) });
  }

  if (pathname === "/api/connections/shortcut/apply" && request.method === "POST") {
    const input = shortcutImportSchema.parse(await readJson(request));
    return json({ result: await applyApprovedShortcutChanges(input.approvalToken) });
  }

  if (pathname === "/api/connections/granola/diagnostics" && request.method === "GET") {
    return json({ diagnostics: await loadGranolaDiagnostics() });
  }

  if (pathname === "/api/connections/granola/schedule" && request.method === "PATCH") {
    const input = granolaScheduleSchema.parse(await readJson(request));
    await updateGranolaScheduleSettings(input.scanIntervalMinutes, input.scanOffsetMinutes);
    return json({ diagnostics: await loadGranolaDiagnostics() });
  }

  if (pathname === "/api/connections/codex/diagnostics" && request.method === "GET") {
    return json({ diagnostics: await loadCodexDiagnostics() });
  }

  if (pathname === "/api/connections/granola/backfill" && request.method === "POST") {
    const input = granolaBackfillSchema.parse(await readJson(request));
    return json({
      result: await backfillRecentGranolaNotes(
        requireEnvironment("GRANOLA_API_KEY"),
        { days: input.days },
      ),
    });
  }

  const acceptedGranolaCandidate = granolaReviewCandidateId(pathname, "accept");
  if (acceptedGranolaCandidate && request.method === "POST") {
    await acceptGranolaReviewCandidate(acceptedGranolaCandidate);
    return json({ diagnostics: await loadGranolaDiagnostics() });
  }

  const dismissedGranolaCandidate = granolaReviewCandidateId(pathname, "dismiss");
  if (dismissedGranolaCandidate && request.method === "POST") {
    await dismissGranolaReviewCandidate(dismissedGranolaCandidate);
    return json({ diagnostics: await loadGranolaDiagnostics() });
  }

  if (pathname === "/api/tasks" && request.method === "GET") {
    const status = new URL(request.url).searchParams.get("status");
    if (status !== null && status !== "open") {
      throw new HttpError(400, "Task status filter must be open.");
    }
    return conditionalJson(request, { tasks: await listTasks(status ?? undefined) });
  }

  if (pathname === "/api/tasks" && request.method === "POST") {
    const input = createTaskSchema.parse(await readJson(request));
    return json({ task: await createTask(input) }, { status: 201 });
  }

  if (pathname === "/api/notifications/config" && request.method === "GET") {
    return json(pushNotificationConfiguration());
  }

  if (pathname === "/api/notifications/subscriptions" && request.method === "POST") {
    const input = pushSubscriptionSchema.parse(await readJson(request));
    await savePushSubscription(input, request.headers.get("user-agent"));
    return noContent();
  }

  if (pathname === "/api/notifications/subscriptions" && request.method === "DELETE") {
    const input = removePushSubscriptionSchema.parse(await readJson(request));
    await removePushSubscription(input.endpoint);
    return noContent();
  }

  const activityTaskId = taskActivityId(pathname);
  if (activityTaskId && request.method === "GET") {
    return json({ activity: await loadTaskAutomationActivity(activityTaskId) });
  }

  const codexTaskId = taskCodexSessionsId(pathname);
  if (codexTaskId && request.method === "GET") {
    return json({ sessions: await listTaskCodexSessions(codexTaskId) });
  }

  if (codexTaskId && request.method === "POST") {
    const input = attachCodexSessionSchema.parse(await readJson(request));
    return json({ session: await attachCodexSession(codexTaskId, input) }, { status: 201 });
  }

  const codexId = codexSessionId(pathname);
  if (codexId && request.method === "PATCH") {
    const input = updateCodexSessionSchema.parse(await readJson(request));
    return json({ session: await updateCodexSession(codexId, input) });
  }

  if (codexId && request.method === "DELETE") {
    await detachCodexSession(codexId);
    return noContent();
  }

  const id = taskId(pathname);

  if (id && request.method === "PATCH") {
    const input = updateTaskSchema.parse(await readJson(request));
    return json({ task: await updateTask(id, input) });
  }

  if (id && request.method === "DELETE") {
    await deleteTask(id);
    return noContent();
  }

  throw new HttpError(404, "Route not found.");
}

export default async (request: Request): Promise<Response> => {
  try {
    return await route(request);
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: error.message, ...error.details }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return json(
        {
          error: "Invalid request.",
          fields: error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    console.error("Todo Trackr API error", error);
    return json({ error: "Unexpected server error." }, { status: 500 });
  }
};

export const config: Config = {
  excludedPath: ["/api/webhooks/shortcut", "/api/webhooks/granola", "/api/work-resume"],
  path: "/api/*",
};

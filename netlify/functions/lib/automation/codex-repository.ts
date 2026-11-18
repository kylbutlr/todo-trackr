import { randomUUID } from "node:crypto";

import { z } from "zod";

import { database } from "../database.js";
import { HttpError } from "../http.js";

export const CODEX_CONNECTION_ID = "00000000-0000-4000-8000-000000000500";

export const codexSessionStatusSchema = z.enum([
  "linked",
  "queued",
  "working",
  "waiting_for_you",
  "ready_for_review",
  "failed",
  "finished",
]);

export type CodexSessionStatus = z.infer<typeof codexSessionStatusSchema>;

export const attachCodexSessionSchema = z.object({
  reference: z.string().trim().min(1).max(2_000),
  title: z.string().trim().min(1).max(500).optional(),
});

export const updateCodexSessionSchema = z.object({
  status: codexSessionStatusSchema.optional(),
  title: z.string().trim().min(1).max(500).nullable().optional(),
  threadUrl: z.url().nullable().optional(),
  latestSummary: z.string().trim().max(10_000).nullable().optional(),
  cwd: z.string().trim().max(2_000).nullable().optional(),
  branchName: z.string().trim().max(500).nullable().optional(),
  prUrl: z.url().nullable().optional(),
  isCurrent: z.boolean().optional(),
});

export const ingestCodexSessionSchema = updateCodexSessionSchema.extend({
  taskId: z.uuid().optional(),
  externalReference: z.string().trim().min(1).max(500).optional(),
  source: z.enum(["shortcut", "granola", "slack", "gmail"]).optional(),
  threadId: z.string().trim().min(1).max(500),
}).refine((input) => input.taskId || (input.externalReference && input.source), {
  message: "Provide taskId, or provide both source and externalReference.",
});

type DateValue = Date | string;

type CodexSessionRow = {
  id: string;
  task_id: string;
  task_title: string;
  thread_id: string;
  thread_url: string | null;
  title: string | null;
  status: CodexSessionStatus;
  latest_summary: string | null;
  cwd: string | null;
  branch_name: string | null;
  pr_url: string | null;
  is_current: boolean;
  last_seen_at: DateValue;
  created_at: DateValue;
  updated_at: DateValue;
};

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

function iso(value: DateValue): string {
  return value instanceof Date ? value.toISOString() : value;
}

function mapSession(row: CodexSessionRow): CodexSession {
  return {
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    threadId: row.thread_id,
    threadUrl: row.thread_url,
    title: row.title,
    status: row.status,
    latestSummary: row.latest_summary,
    cwd: row.cwd,
    branchName: row.branch_name,
    prUrl: row.pr_url,
    isCurrent: row.is_current,
    lastSeenAt: iso(row.last_seen_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

const sessionSelect = `
  SELECT sessions.*, tasks.title AS task_title
  FROM codex_sessions AS sessions
  INNER JOIN tasks ON tasks.id = sessions.task_id
`;

export function parseCodexReference(reference: string): { threadId: string; threadUrl: string | null } {
  const trimmed = reference.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Unsupported URL protocol.");
    if (!["chatgpt.com", "www.chatgpt.com", "chat.openai.com"].includes(url.hostname.toLowerCase())) {
      throw new HttpError(400, "Enter a Codex conversation URL from ChatGPT or a raw thread ID.");
    }
    const segments = url.pathname.split("/").filter(Boolean);
    const threadId = segments.at(-1);
    if (!threadId) throw new HttpError(400, "That Codex conversation URL does not include a thread ID.");
    return { threadId, threadUrl: url.toString() };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (/^https?:/iu.test(trimmed)) throw new HttpError(400, "Enter a valid Codex conversation URL or thread ID.");
    return { threadId: trimmed, threadUrl: null };
  }
}

async function taskExists(taskId: string): Promise<boolean> {
  const sql = database();
  const rows = await sql`SELECT id FROM tasks WHERE id = ${taskId} LIMIT 1` as unknown as Array<{ id: string }>;
  return Boolean(rows[0]);
}

async function loadSessionById(id: string): Promise<CodexSession> {
  const sql = database();
  const rows = await sql.query(`${sessionSelect} WHERE sessions.id = $1 LIMIT 1`, [id]) as unknown as CodexSessionRow[];
  if (!rows[0]) throw new HttpError(404, "Codex work session not found.");
  return mapSession(rows[0]);
}

export async function listTaskCodexSessions(taskId: string): Promise<CodexSession[]> {
  const sql = database();
  const rows = await sql.query(
    `${sessionSelect} WHERE sessions.task_id = $1 ORDER BY sessions.is_current DESC, sessions.updated_at DESC`,
    [taskId],
  ) as unknown as CodexSessionRow[];
  return rows.map(mapSession);
}

export async function attachCodexSession(taskId: string, input: z.infer<typeof attachCodexSessionSchema>): Promise<CodexSession> {
  if (!await taskExists(taskId)) throw new HttpError(404, "Task not found.");
  const sql = database();
  const { threadId, threadUrl } = parseCodexReference(input.reference);
  const existing = await sql`SELECT id, task_id FROM codex_sessions WHERE thread_id = ${threadId} LIMIT 1` as unknown as Array<{ id: string; task_id: string }>;
  if (existing[0] && existing[0].task_id !== taskId) {
    throw new HttpError(409, "That Codex conversation is already attached to another Task.");
  }

  await sql`UPDATE codex_sessions SET is_current = false, updated_at = now() WHERE task_id = ${taskId} AND is_current`;
  const id = existing[0]?.id ?? randomUUID();
  await sql`
    INSERT INTO codex_sessions (id, task_id, thread_id, thread_url, title)
    VALUES (${id}, ${taskId}, ${threadId}, ${threadUrl}, ${input.title ?? null})
    ON CONFLICT (thread_id) DO UPDATE SET
      thread_url = COALESCE(EXCLUDED.thread_url, codex_sessions.thread_url),
      title = COALESCE(EXCLUDED.title, codex_sessions.title),
      is_current = true,
      last_seen_at = now(),
      updated_at = now()
  `;
  await markCodexConnectionHealthy();
  return loadSessionById(id);
}

export async function updateCodexSession(id: string, input: z.infer<typeof updateCodexSessionSchema>): Promise<CodexSession> {
  const current = await loadSessionById(id);
  const next = {
    status: input.status ?? current.status,
    title: input.title === undefined ? current.title : input.title,
    threadUrl: input.threadUrl === undefined ? current.threadUrl : input.threadUrl,
    latestSummary: input.latestSummary === undefined ? current.latestSummary : input.latestSummary,
    cwd: input.cwd === undefined ? current.cwd : input.cwd,
    branchName: input.branchName === undefined ? current.branchName : input.branchName,
    prUrl: input.prUrl === undefined ? current.prUrl : input.prUrl,
    isCurrent: input.isCurrent ?? current.isCurrent,
  };
  const sql = database();
  if (next.isCurrent) {
    await sql`UPDATE codex_sessions SET is_current = false, updated_at = now() WHERE task_id = ${current.taskId} AND id <> ${id} AND is_current`;
  }
  await sql`
    UPDATE codex_sessions SET
      status = ${next.status}, title = ${next.title}, thread_url = ${next.threadUrl},
      latest_summary = ${next.latestSummary}, cwd = ${next.cwd}, branch_name = ${next.branchName},
      pr_url = ${next.prUrl}, is_current = ${next.isCurrent}, last_seen_at = now(), updated_at = now()
    WHERE id = ${id}
  `;
  await markCodexConnectionHealthy();
  return loadSessionById(id);
}

export async function detachCodexSession(id: string): Promise<void> {
  const sql = database();
  const result = await sql`DELETE FROM codex_sessions WHERE id = ${id} RETURNING id` as unknown as Array<{ id: string }>;
  if (!result[0]) throw new HttpError(404, "Codex work session not found.");
}

async function markCodexConnectionHealthy(): Promise<void> {
  const sql = database();
  await sql`
    UPDATE source_connections SET health = 'healthy', last_success_at = now(),
      last_failure_message = NULL, consecutive_failures = 0, updated_at = now()
    WHERE id = ${CODEX_CONNECTION_ID}
  `;
}

export async function ingestCodexSession(input: z.infer<typeof ingestCodexSessionSchema>): Promise<CodexSession> {
  const sql = database();
  let taskId = input.taskId;
  if (!taskId && input.externalReference && input.source) {
    const rows = await sql`
      SELECT links.task_id
      FROM automated_task_links AS links
      INNER JOIN source_objects AS objects ON objects.id = links.source_object_id
      INNER JOIN source_connections AS connections ON connections.id = objects.connection_id
      WHERE objects.external_reference = ${input.externalReference}
        AND connections.source = ${input.source}
      ORDER BY links.linked_at DESC LIMIT 1
    ` as unknown as Array<{ task_id: string }>;
    taskId = rows[0]?.task_id;
  }
  if (!taskId) throw new HttpError(404, "No Todo Trackr Task matches that Codex update.");

  const rows = await sql`SELECT id FROM codex_sessions WHERE thread_id = ${input.threadId} LIMIT 1` as unknown as Array<{ id: string }>;
  const session = rows[0]
    ? await updateCodexSession(rows[0].id, input)
    : await attachCodexSession(taskId, { reference: input.threadUrl ?? input.threadId, title: input.title ?? undefined });
  return rows[0] ? session : updateCodexSession(session.id, input);
}

export async function loadCodexDiagnostics(): Promise<{
  connection: { id: string; name: string; health: string; lastSuccessAt: string | null };
  counts: Record<CodexSessionStatus, number>;
  sessions: CodexSession[];
}> {
  const sql = database();
  const connections = await sql`
    SELECT id, name, health, last_success_at FROM source_connections WHERE id = ${CODEX_CONNECTION_ID} LIMIT 1
  ` as unknown as Array<{ id: string; name: string; health: string; last_success_at: DateValue | null }>;
  if (!connections[0]) throw new HttpError(503, "Codex session tables are unavailable. Apply migration 0012.");
  const countRows = await sql`SELECT status, count(*)::integer AS count FROM codex_sessions WHERE is_current GROUP BY status` as unknown as Array<{ status: CodexSessionStatus; count: number }>;
  const counts = Object.fromEntries(codexSessionStatusSchema.options.map((status) => [status, 0])) as Record<CodexSessionStatus, number>;
  for (const row of countRows) counts[row.status] = row.count;
  const rows = await sql.query(`${sessionSelect} WHERE sessions.is_current ORDER BY sessions.updated_at DESC LIMIT 40`) as unknown as CodexSessionRow[];
  return {
    connection: {
      id: connections[0].id,
      name: connections[0].name,
      health: connections[0].health,
      lastSuccessAt: connections[0].last_success_at ? iso(connections[0].last_success_at) : null,
    },
    counts,
    sessions: rows.map(mapSession),
  };
}

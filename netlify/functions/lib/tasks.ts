import { randomUUID } from "node:crypto";

import { z } from "zod";

import { database } from "./database.js";
import { HttpError } from "./http.js";
import { INBOX_LIST_ID } from "./lists.js";
import { cancelTaskAlarm, scheduleTaskAlarm } from "./task-alarm-trigger.js";

const prioritySchema = z.enum(["none", "lowest", "low", "medium", "high", "highest"]);
const sourceSchema = z.enum(["manual", "browser", "slack"]);
const sourceUrlSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Source URL must use HTTP or HTTPS.");

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(500),
  notes: z.string().max(10_000).default(""),
  priority: prioritySchema.default("none"),
  dueAt: z.iso.datetime({ offset: true }).nullable().default(null),
  listId: z.uuid().default(INBOX_LIST_ID),
  source: sourceSchema.default("manual"),
  sourceUrl: sourceUrlSchema.nullable().default(null),
}).superRefine((value, context) => {
  if (value.source === "browser" && !value.sourceUrl) {
    context.addIssue({
      code: "custom",
      path: ["sourceUrl"],
      message: "Browser Quick Capture requires a source URL.",
    });
  }
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    notes: z.string().max(10_000).optional(),
    status: z.enum(["open", "completed"]).optional(),
    priority: prioritySchema.optional(),
    dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
    sortOrder: z.number().int().safe().optional(),
    listId: z.uuid().optional(),
    isStarred: z.boolean().optional(),
    alarmAt: z.iso.datetime({ offset: true }).nullable().optional(),
    clearAlarm: z.literal(true).optional(),
    expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .refine((value) => !(value.alarmAt !== undefined && value.clearAlarm), {
    message: "Set or clear an alarm in one action, not both.",
  })
  .refine((value) => Object.keys(value).some((key) => key !== "expectedUpdatedAt"), {
    message: "At least one task field is required.",
  });

export function assertTaskUpdateAllowed(
  source: TaskRow["source"],
  input: z.infer<typeof updateTaskSchema>,
): void {
  if (source !== "shortcut") return;

  const changesSourceOwnedField = input.title !== undefined
    || input.status !== undefined
    || input.priority !== undefined
    || input.dueAt !== undefined
    || input.sortOrder !== undefined;
  if (changesSourceOwnedField) {
    throw new HttpError(409, "Shortcut controls this Task's title, lifecycle, priority, and due date.");
  }
}

type TaskRow = {
  id: string;
  title: string;
  notes: string;
  status: "open" | "completed" | "archived";
  priority: "none" | "lowest" | "low" | "medium" | "high" | "highest";
  due_at: Date | string | null;
  sort_order: number;
  created_at: Date | string;
  updated_at: Date | string;
  completed_at: Date | string | null;
  archived_at: Date | string | null;
  deleted_at?: Date | string | null;
  is_starred: boolean;
  alarm_at: Date | string | null;
  alarm_notified_at: Date | string | null;
  alarm_cleared_at: Date | string | null;
  alarm_trigger_run_id: string | null;
  list_id: string;
  source: "manual" | "browser" | "shortcut" | "granola" | "slack" | "gmail";
  source_url: string | null;
  source_external_reference?: string | null;
  source_summary?: string | null;
  source_size?: "S" | "M" | "L" | "XL" | null;
  source_workflow_state_name?: string | null;
  source_epic_name?: string | null;
};

export type TaskSourceDetails = {
  externalReference: string;
  summary: string | null;
  size: "S" | "M" | "L" | "XL" | null;
  workflowStateName: string | null;
  epicName: string | null;
};

export type Task = {
  id: string;
  title: string;
  notes: string;
  status: "open" | "completed" | "archived";
  priority: "none" | "lowest" | "low" | "medium" | "high" | "highest";
  dueAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  updateToken: string;
  completedAt: string | null;
  archivedAt: string | null;
  isStarred: boolean;
  alarmAt: string | null;
  alarmNotifiedAt: string | null;
  alarmClearedAt: string | null;
  needsAttention: boolean;
  listId: string;
  source: "manual" | "browser" | "shortcut" | "granola" | "slack" | "gmail";
  sourceUrl: string | null;
  sourceDetails: TaskSourceDetails | null;
};

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function nullableIso(value: Date | string | null): string | null {
  return value === null ? null : iso(value);
}

function serialize(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    status: row.status,
    priority: row.priority,
    dueAt: nullableIso(row.due_at),
    sortOrder: Number(row.sort_order),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    updateToken: iso(row.updated_at),
    completedAt: nullableIso(row.completed_at),
    archivedAt: nullableIso(row.archived_at),
    isStarred: row.is_starred,
    alarmAt: nullableIso(row.alarm_at),
    alarmNotifiedAt: nullableIso(row.alarm_notified_at),
    alarmClearedAt: nullableIso(row.alarm_cleared_at),
    needsAttention: row.status === "open"
      && row.alarm_at !== null
      && new Date(row.alarm_at).getTime() <= Date.now()
      && row.alarm_cleared_at === null,
    listId: row.list_id,
    source: row.source,
    sourceUrl: row.source_url,
    sourceDetails: row.source_external_reference ? {
      externalReference: row.source_external_reference,
      summary: row.source_summary ?? null,
      size: row.source_size ?? null,
      workflowStateName: row.source_workflow_state_name ?? null,
      epicName: row.source_epic_name ?? null,
    } : null,
  };
}

// Neon parses timestamptz values into JavaScript Dates, which discard PostgreSQL
// microseconds. Return the optimistic-lock token as text so it round-trips exactly.
const columns = `
  tasks.id,
  tasks.title,
  tasks.notes,
  tasks.status,
  tasks.priority,
  tasks.due_at,
  tasks.sort_order,
  tasks.created_at,
  to_char(
    tasks.updated_at AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
  ) AS updated_at,
  tasks.completed_at,
  tasks.archived_at,
  tasks.is_starred,
  tasks.alarm_at,
  tasks.alarm_notified_at,
  tasks.alarm_cleared_at,
  tasks.alarm_trigger_run_id,
  tasks.list_id,
  tasks.source,
  tasks.source_url,
  source.external_reference AS source_external_reference,
  source.source_summary,
  source.size AS source_size,
  source.workflow_state_name AS source_workflow_state_name,
  source.epic_name AS source_epic_name
`;

type TaskListStatus = "open";

export function taskListQuery(status?: TaskListStatus): { text: string; values: string[] } {
  const where = status
    ? "WHERE tasks.deleted_at IS NULL AND tasks.status = $1"
    : "WHERE tasks.deleted_at IS NULL";

  return {
    text: `
    SELECT ${columns}
    FROM tasks
    LEFT JOIN automated_task_links AS links ON links.task_id = tasks.id
    LEFT JOIN source_objects AS source ON source.id = links.source_object_id
    ${where}
    ORDER BY
      CASE WHEN tasks.status = 'open' THEN 0 ELSE 1 END,
      tasks.sort_order ASC,
      tasks.created_at DESC
  `,
    values: status ? [status] : [],
  };
}

export async function listTasks(status?: TaskListStatus): Promise<Task[]> {
  const sql = database();
  const query = taskListQuery(status);
  const rows = (await sql.query(query.text, query.values)) as TaskRow[];

  return rows.map(serialize);
}

export async function createTask(input: z.infer<typeof createTaskSchema>): Promise<Task> {
  const sql = database();
  const id = randomUUID();
  await sql`
    INSERT INTO tasks (id, title, notes, priority, due_at, list_id, source, source_url)
    VALUES (${id}, ${input.title}, ${input.notes}, ${input.priority}, ${input.dueAt}, ${input.listId}, ${input.source}, ${input.sourceUrl})
  `;

  return serialize(await taskRow(id));
}

async function taskRow(id: string): Promise<TaskRow> {
  const sql = database();
  const rows = (await sql.query(`
    SELECT ${columns}
    FROM tasks
    LEFT JOIN automated_task_links AS links ON links.task_id = tasks.id
    LEFT JOIN source_objects AS source ON source.id = links.source_object_id
    WHERE tasks.id = $1 AND tasks.deleted_at IS NULL
  `, [id])) as TaskRow[];

  if (!rows[0]) {
    throw new HttpError(404, "Task not found.");
  }

  return rows[0];
}

export async function updateTask(
  id: string,
  input: z.infer<typeof updateTaskSchema>,
): Promise<Task> {
  const current = await taskRow(id);
  assertTaskUpdateAllowed(current.source, input);
  const sql = database();
  const status = input.status ?? current.status;
  const completedAt =
    status === "completed"
      ? current.completed_at ?? new Date().toISOString()
      : null;
  const archivedAt =
    status === "archived"
      ? current.archived_at ?? new Date().toISOString()
      : null;
  const currentActiveAlarm = current.alarm_cleared_at === null ? current.alarm_at : null;
  const changesAlarm = input.alarmAt !== undefined && (
    input.alarmAt === null
      ? currentActiveAlarm !== null
      : currentActiveAlarm === null
        || new Date(input.alarmAt).getTime() !== new Date(currentActiveAlarm).getTime()
  );
  const alarmAt = changesAlarm ? input.alarmAt : current.alarm_at;
  const alarmClearedAt = input.clearAlarm
    ? new Date().toISOString()
    : changesAlarm
      ? null
      : status === "open"
        ? current.alarm_cleared_at
        : current.alarm_at === null
          ? current.alarm_cleared_at
          : current.alarm_cleared_at ?? new Date().toISOString();
  const alarmNotifiedAt = changesAlarm ? null : current.alarm_notified_at;
  const activeAlarm = status === "open"
    && alarmAt !== null
    && alarmClearedAt === null
    && alarmNotifiedAt === null;
  const shouldScheduleAlarm = activeAlarm && (changesAlarm || !current.alarm_trigger_run_id);
  const scheduledRunId = shouldScheduleAlarm
    ? await scheduleTaskAlarm(id, iso(alarmAt as Date | string))
    : null;
  const alarmTriggerRunId = activeAlarm
    ? scheduledRunId ?? current.alarm_trigger_run_id
    : null;

  let rows: Array<{ id: string }>;
  try {
    rows = (await sql`
      UPDATE tasks
      SET
        title = ${input.title ?? current.title},
        notes = ${input.notes ?? current.notes},
        status = ${status},
        priority = ${input.priority ?? current.priority},
        due_at = ${input.dueAt === undefined ? current.due_at : input.dueAt},
        sort_order = ${input.sortOrder ?? current.sort_order},
        updated_at = now(),
        completed_at = ${completedAt},
        archived_at = ${archivedAt},
        is_starred = ${input.isStarred ?? current.is_starred},
        alarm_at = ${alarmAt},
        alarm_notified_at = ${alarmNotifiedAt},
        alarm_cleared_at = ${alarmAt === null ? null : alarmClearedAt},
        alarm_trigger_run_id = ${alarmTriggerRunId},
        list_id = ${input.listId ?? current.list_id}
      WHERE id = ${id}
        AND (${input.expectedUpdatedAt === undefined} OR updated_at = ${input.expectedUpdatedAt ?? current.updated_at}::timestamptz)
      RETURNING id
    `) as Array<{ id: string }>;
  } catch (error) {
    await cancelTaskAlarm(scheduledRunId);
    throw error;
  }

  if (!rows[0] && input.expectedUpdatedAt !== undefined) {
    await cancelTaskAlarm(scheduledRunId);
    throw new HttpError(409, "This Task changed elsewhere. Your edits are still here.", {
      code: "TASK_CONFLICT",
      currentTask: serialize(await taskRow(id)),
    });
  }

  if (rows[0] && current.alarm_trigger_run_id !== alarmTriggerRunId) {
    await cancelTaskAlarm(current.alarm_trigger_run_id);
  }

  return serialize(await taskRow(id));
}

export async function deleteTask(id: string): Promise<void> {
  const current = await taskRow(id);
  if (current.source === "shortcut") {
    throw new HttpError(409, "Shortcut controls this Task's lifecycle. Pause or change it in Shortcut instead.");
  }
  const sql = database();
  const rows = (await sql`
    UPDATE tasks
    SET deleted_at = now(), alarm_trigger_run_id = NULL, updated_at = now()
    WHERE id = ${id} AND deleted_at IS NULL
    RETURNING id
  `) as Array<{ id: string }>;

  if (!rows[0]) {
    throw new HttpError(404, "Task not found.");
  }

  await cancelTaskAlarm(current.alarm_trigger_run_id);
}

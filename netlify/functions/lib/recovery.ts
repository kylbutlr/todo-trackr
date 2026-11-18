import { randomUUID } from "node:crypto";

import { z } from "zod";

import packageMetadata from "../../../package.json" with { type: "json" };

import { database } from "./database.js";
import { HttpError } from "./http.js";
import { INBOX_LIST_ID } from "./lists.js";

export const BACKUP_VERSION = 1;

const dateSchema = z.iso.datetime({ offset: true });
const nullableDateSchema = dateSchema.nullable();
const prioritySchema = z.enum(["none", "lowest", "low", "medium", "high", "highest"]);
const statusSchema = z.enum(["open", "completed", "archived"]);
const recoverableSourceSchema = z.enum(["manual", "browser", "granola", "slack", "gmail"]);

const backupListSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(100),
  sortOrder: z.number().int().safe(),
  isInbox: z.boolean(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

const backupTaskSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(500),
  notes: z.string().max(10_000),
  status: statusSchema,
  priority: prioritySchema,
  dueAt: nullableDateSchema,
  sortOrder: z.number().int().safe(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
  completedAt: nullableDateSchema,
  archivedAt: nullableDateSchema,
  deletedAt: nullableDateSchema,
  isStarred: z.boolean(),
  alarmAt: nullableDateSchema.optional().default(null),
  alarmNotifiedAt: nullableDateSchema.optional().default(null),
  alarmClearedAt: nullableDateSchema.optional().default(null),
  listId: z.uuid(),
  source: z.enum(["manual", "browser", "shortcut", "granola", "slack", "gmail"]),
  sourceUrl: z.url().nullable(),
});

export const backupImportSchema = z.object({
  version: z.literal(BACKUP_VERSION),
  exportedAt: dateSchema,
  appVersion: z.string().min(1).max(50),
  lists: z.array(backupListSchema).max(1_000),
  tasks: z.array(backupTaskSchema).max(50_000),
});

type DateValue = Date | string | null;

type BackupListRow = {
  id: string;
  name: string;
  sort_order: number;
  is_inbox: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

type BackupTaskRow = {
  id: string;
  title: string;
  notes: string;
  status: "open" | "completed" | "archived";
  priority: "none" | "lowest" | "low" | "medium" | "high" | "highest";
  due_at: DateValue;
  sort_order: number;
  created_at: Date | string;
  updated_at: Date | string;
  completed_at: DateValue;
  archived_at: DateValue;
  deleted_at: DateValue;
  is_starred: boolean;
  alarm_at: DateValue;
  alarm_notified_at: DateValue;
  alarm_cleared_at: DateValue;
  list_id: string;
  source: "manual" | "browser" | "shortcut" | "granola" | "slack" | "gmail";
  source_url: string | null;
};

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function nullableIso(value: DateValue): string | null {
  return value === null ? null : iso(value);
}

export async function createJsonBackup(now = new Date()) {
  const sql = database();
  const [lists, tasks] = await Promise.all([
    sql`
      SELECT id, name, sort_order, is_inbox, created_at, updated_at
      FROM task_lists
      ORDER BY sort_order ASC, created_at ASC
    ` as unknown as Promise<BackupListRow[]>,
    sql`
      SELECT
        id, title, notes, status, priority, due_at, sort_order, created_at,
        updated_at, completed_at, archived_at, deleted_at, is_starred,
        alarm_at, alarm_notified_at, alarm_cleared_at,
        list_id, source, source_url
      FROM tasks
      ORDER BY created_at ASC
    ` as unknown as Promise<BackupTaskRow[]>,
  ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    appVersion: packageMetadata.version,
    lists: lists.map((list) => ({
      id: list.id,
      name: list.name,
      sortOrder: Number(list.sort_order),
      isInbox: list.is_inbox,
      createdAt: iso(list.created_at),
      updatedAt: iso(list.updated_at),
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      notes: task.notes,
      status: task.status,
      priority: task.priority,
      dueAt: nullableIso(task.due_at),
      sortOrder: Number(task.sort_order),
      createdAt: iso(task.created_at),
      updatedAt: iso(task.updated_at),
      completedAt: nullableIso(task.completed_at),
      archivedAt: nullableIso(task.archived_at),
      deletedAt: nullableIso(task.deleted_at),
      isStarred: task.is_starred,
      alarmAt: nullableIso(task.alarm_at),
      alarmNotifiedAt: nullableIso(task.alarm_notified_at),
      alarmClearedAt: nullableIso(task.alarm_cleared_at),
      listId: task.list_id,
      source: task.source,
      sourceUrl: task.source_url,
    })),
  };
}

export async function importJsonBackup(input: z.infer<typeof backupImportSchema>) {
  const sql = database();
  let restoredLists = 0;
  let restoredTasks = 0;
  let skippedTasks = 0;

  for (const list of input.lists) {
    if (list.isInbox) continue;
    const rows = await sql`
      INSERT INTO task_lists (id, name, sort_order, is_inbox, created_at, updated_at)
      VALUES (${list.id}, ${list.name}, ${list.sortOrder}, false, ${list.createdAt}, ${list.updatedAt})
      ON CONFLICT DO NOTHING
      RETURNING id
    ` as unknown as Array<{ id: string }>;
    restoredLists += rows.length;
  }

  const availableLists = await sql`SELECT id FROM task_lists` as unknown as Array<{ id: string }>;
  const availableListIds = new Set(availableLists.map(({ id }) => id));

  for (const task of input.tasks) {
    if (!recoverableSourceSchema.safeParse(task.source).success) {
      skippedTasks += 1;
      continue;
    }
    const listId = availableListIds.has(task.listId) ? task.listId : INBOX_LIST_ID;
    const rows = await sql`
      INSERT INTO tasks (
        id, title, notes, status, priority, due_at, sort_order, created_at,
        updated_at, completed_at, archived_at, deleted_at, is_starred,
        alarm_at, alarm_notified_at, alarm_cleared_at,
        list_id, source, source_url
      ) VALUES (
        ${task.id}, ${task.title}, ${task.notes}, ${task.status}, ${task.priority},
        ${task.dueAt}, ${task.sortOrder}, ${task.createdAt}, ${task.updatedAt},
        ${task.completedAt}, ${task.archivedAt}, ${task.deletedAt}, ${task.isStarred},
        ${task.alarmAt}, ${task.alarmNotifiedAt}, ${task.alarmClearedAt},
        ${listId}, ${task.source}, ${task.sourceUrl}
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    ` as unknown as Array<{ id: string }>;
    restoredTasks += rows.length;
    if (rows.length === 0) skippedTasks += 1;
  }

  const runId = randomUUID();
  await sql`
    INSERT INTO recovery_runs (
      id, backup_version, mode, restored_lists, restored_tasks, skipped_tasks
    ) VALUES (
      ${runId}, ${BACKUP_VERSION}, 'only_missing', ${restoredLists}, ${restoredTasks}, ${skippedTasks}
    )
  `;

  return { runId, mode: "only_missing" as const, restoredLists, restoredTasks, skippedTasks };
}

export async function listDeletedTasks() {
  const sql = database();
  const rows = await sql`
    SELECT id, title, source, deleted_at
    FROM tasks
    WHERE deleted_at IS NOT NULL
    ORDER BY deleted_at DESC
    LIMIT 100
  ` as unknown as Array<{ id: string; title: string; source: string; deleted_at: Date | string }>;
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    source: row.source,
    deletedAt: iso(row.deleted_at),
  }));
}

export async function restoreDeletedTask(id: string): Promise<void> {
  const sql = database();
  const rows = await sql`
    UPDATE tasks
    SET deleted_at = NULL, updated_at = now()
    WHERE id = ${id} AND deleted_at IS NOT NULL
    RETURNING id
  ` as unknown as Array<{ id: string }>;
  if (!rows[0]) throw new HttpError(404, "Deleted Task not found.");
}

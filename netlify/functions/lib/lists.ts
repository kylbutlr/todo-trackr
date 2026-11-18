import { randomUUID } from "node:crypto";

import { z } from "zod";

import { database } from "./database.js";
import { HttpError } from "./http.js";

export const INBOX_LIST_ID = "00000000-0000-4000-8000-000000000001";

export const createListSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

type ListRow = {
  id: string;
  name: string;
  sort_order: number;
  is_inbox: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

export type TaskList = {
  id: string;
  name: string;
  sortOrder: number;
  isInbox: boolean;
  createdAt: string;
  updatedAt: string;
};

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function serialize(row: ListRow): TaskList {
  return {
    id: row.id,
    name: row.name,
    sortOrder: Number(row.sort_order),
    isInbox: row.is_inbox,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export async function listTaskLists(): Promise<TaskList[]> {
  const sql = database();
  const rows = (await sql`
    SELECT id, name, sort_order, is_inbox, created_at, updated_at
    FROM task_lists
    ORDER BY is_inbox DESC, sort_order ASC, lower(name) ASC
  `) as ListRow[];

  return rows.map(serialize);
}

export async function createTaskList(input: z.infer<typeof createListSchema>): Promise<TaskList> {
  const sql = database();
  try {
    const rows = (await sql`
      INSERT INTO task_lists (id, name)
      VALUES (${randomUUID()}, ${input.name})
      RETURNING id, name, sort_order, is_inbox, created_at, updated_at
    `) as ListRow[];

    return serialize(rows[0]);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      throw new HttpError(409, "A list with this name already exists.");
    }
    throw error;
  }
}

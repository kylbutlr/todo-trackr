import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { scryptSync } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { closeDatabase, database } from "../netlify/functions/lib/database.js";
import api from "../netlify/functions/api.mjs";
import { deliverDueAlarms } from "../server/alarms.js";

let directory: string;
let postgres: PGlite;
let socket: PGLiteSocketServer;
const run = promisify(execFile);
const origin = "http://127.0.0.1:8888";

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "todo-trackr-database-"));
  postgres = await PGlite.create();
  socket = new PGLiteSocketServer({ db: postgres, path: join(directory, ".s.PGSQL.5432"), maxConnections: 5 });
  await socket.start();
  vi.stubEnv("TODO_TRACKER_RUNTIME", "standalone");
  vi.stubEnv("TODO_TRACKER_AUTH_MODE", "none");
  vi.stubEnv("TODO_TRACKER_PUBLIC_ORIGIN", origin);
  vi.stubEnv("DATABASE_URL", `postgresql://postgres@localhost/postgres?host=${encodeURIComponent(directory)}`);
  await run(process.execPath, ["scripts/migrate-database.mjs"], { env: process.env, timeout: 45_000 });
});

afterAll(async () => {
  await closeDatabase();
  await socket?.stop();
  await postgres?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

async function request(path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) {
  return api(new Request(`${origin}${path}`, {
    method, headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
}

it("applies the full schema and reruns migrations without changing it", async () => {
  expect((await database()`SELECT max(version)::int AS version FROM schema_migrations`)[0].version).toBe(17);
  await run(process.execPath, ["scripts/migrate-database.mjs"], { env: process.env, timeout: 30_000 });
  expect((await database()`SELECT count(*)::int AS count FROM todo_tracker_migrations`)[0].count).toBe(17);
});

it("runs the generic capture/edit/recovery flow without integration credentials", async () => {
  const created = await request("/api/tasks", "POST", { title: "Independent task" });
  expect(created.status).toBe(201);
  const { task } = await created.json();
  const updated = await request(`/api/tasks/${task.id}`, "PATCH", { title: "Edited task", expectedUpdatedAt: task.updateToken });
  expect(updated.status).toBe(200);
  const conflict = await request(`/api/tasks/${task.id}`, "PATCH", { notes: "stale edit", expectedUpdatedAt: task.updateToken });
  expect(conflict.status).toBe(409);
  expect((await request("/api/tasks")).status).toBe(200);
  expect((await request(`/api/tasks/${task.id}`, "DELETE")).status).toBe(204);
  expect((await request(`/api/recovery/deleted/${task.id}/restore`, "POST")).status).toBe(204);
  const backup = await (await request("/api/recovery/export")).json();
  expect(backup.tasks.some((item: { id: string }) => item.id === task.id)).toBe(true);
});

it("rolls back an entire transaction when a later statement fails", async () => {
  const sql = database();
  await expect(sql.transaction((tx) => [
    tx`INSERT INTO task_lists(id,name,is_inbox,sort_order) VALUES ('00000000-0000-4000-8000-000000000099','Rollback check',false,0)`,
    tx`SELECT 1 / 0`,
  ])).rejects.toThrow();
  expect(await sql`SELECT id FROM task_lists WHERE name = 'Rollback check'`).toEqual([]);
});

it("delivers durable due alarms once and ignores cancellation", async () => {
  const { task } = await (await request("/api/tasks", "POST", { title: "Alarm task" })).json();
  const alarm = new Date(Date.now() - 1000).toISOString();
  expect((await request(`/api/tasks/${task.id}`, "PATCH", { alarmAt: alarm })).status).toBe(200);
  expect(await deliverDueAlarms()).toBe(1);
  expect(await deliverDueAlarms()).toBe(0);
  await request(`/api/tasks/${task.id}`, "PATCH", { alarmAt: new Date(Date.now() - 500).toISOString() });
  await request(`/api/tasks/${task.id}`, "PATCH", { clearAlarm: true });
  expect(await deliverDueAlarms()).toBe(0);
});

it("supports protected local sessions and rejects unauthorized requests", async () => {
  vi.stubEnv("TODO_TRACKER_AUTH_MODE", "password");
  vi.stubEnv("SESSION_SIGNING_SECRET", "local-integration-test-signing-secret-32-characters");
  const salt = Buffer.from("local-test-salt");
  vi.stubEnv("TODO_TRACKER_PASSWORD_HASH", `scrypt$${salt.toString("base64")}$${scryptSync("correct-password", salt, 64).toString("base64")}`);
  expect((await request("/api/tasks")).status).toBe(401);
  expect((await request("/api/auth/login", "POST", { password: "incorrect" })).status).toBe(401);
  const login = await request("/api/auth/login", "POST", { password: "correct-password" });
  expect(login.status).toBe(200);
  expect(login.headers.get("set-cookie")).not.toContain(" Secure;");
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  expect((await request("/api/tasks", "GET", undefined, { cookie })).status).toBe(200);
});

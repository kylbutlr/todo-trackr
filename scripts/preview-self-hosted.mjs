import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { scryptSync, randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

// This is a bounded, disposable review session, never a production database.
await new Promise((resolve, reject) => {
  const probe = createConnection({ host: "127.0.0.1", port: 8888 });
  probe.once("connect", () => { probe.destroy(); reject(new Error("Port 8888 is occupied. Reuse or stop the owning session before starting this preview.")); });
  probe.once("error", (error) => error.code === "ECONNREFUSED" ? resolve() : reject(error));
});
const directory = await mkdtemp(join(tmpdir(), "todo-trackr-preview-"));
const database = await PGlite.create();
const socket = new PGLiteSocketServer({ db: database, path: join(directory, ".s.PGSQL.5432"), maxConnections: 5 });
const password = process.env.TODO_TRACKER_PREVIEW_PASSWORD;
const salt = randomBytes(16);
const env = {
  ...process.env, TODO_TRACKER_RUNTIME: "standalone", TODO_TRACKER_HOST: "127.0.0.1", TODO_TRACKER_PORT: "8888",
  TODO_TRACKER_PUBLIC_ORIGIN: "http://127.0.0.1:8888", TODO_TRACKER_AUTH_MODE: password ? "password" : "none",
  DATABASE_URL: `postgresql://postgres@localhost/postgres?host=${encodeURIComponent(directory)}`,
  TODO_TRACKER_PASSWORD_HASH: password ? `scrypt$${salt.toString("base64")}$${scryptSync(password, salt, 64).toString("base64")}` : "",
  SESSION_SIGNING_SECRET: randomBytes(32).toString("hex"),
  TODO_TRACKER_SHORTCUT_ENABLED: "false", TODO_TRACKER_GRANOLA_ENABLED: "false", TODO_TRACKER_CODEX_ENABLED: "false",
  APP_SWITCHR_URL: "", APP_SWITCHR_READER_TOKEN: "", VAPID_PUBLIC_KEY: "", VAPID_PRIVATE_KEY: "", VAPID_SUBJECT: "",
};
let child;
let stopped = false;
async function stop() {
  if (stopped) return;
  stopped = true;
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    const force = setTimeout(() => child.kill("SIGKILL"), 5_000);
    await new Promise((resolve) => child.once("exit", resolve));
    clearTimeout(force);
  }
}
const budget = setTimeout(() => { console.log("Preview time budget reached; stopping."); void stop(); }, 9 * 60_000);
process.on("SIGINT", () => { void stop(); });
process.on("SIGTERM", () => { void stop(); });
try {
  await socket.start();
  child = spawn(process.execPath, ["scripts/migrate-database.mjs"], { env, stdio: "inherit" });
  const migrated = await new Promise((resolve) => child.once("exit", resolve));
  if (migrated !== 0 || stopped) throw new Error("Preview migration did not finish.");
  child = spawn(process.execPath, ["dist/server.mjs"], { env, stdio: "inherit" });
  console.log(JSON.stringify({ previewOwnerPID: process.pid, serverPID: child.pid, port: 8888, url: "http://127.0.0.1:8888", databaseSocket: directory }));
  await new Promise((resolve) => child.once("exit", resolve));
} finally {
  clearTimeout(budget);
  await stop();
  await socket.stop();
  await database.close();
  await rm(directory, { recursive: true, force: true });
  console.log("Preview stopped; disposable database removed.");
}

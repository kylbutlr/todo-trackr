import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// Every resource belongs to a fresh Compose project. Never load a real .env file.
const origin = "http://127.0.0.1:8888";
await new Promise((done, fail) => {
  const probe = createConnection({ host: "127.0.0.1", port: 8888 });
  probe.once("connect", () => { probe.destroy(); fail(new Error("Port 8888 is occupied. Stop or reuse its owner before rehearsal.")); });
  probe.once("error", (error) => error.code === "ECONNREFUSED" ? done() : fail(error));
});
const directory = await mkdtemp(join(tmpdir(), "todo-trackr-compose-"));
const project = `todo-trackr-check-${randomBytes(5).toString("hex")}`;
const docker = process.env.TODO_TRACKER_DOCKER_COMMAND || "docker";
const environment = Object.fromEntries(["PATH", "HOME", "DOCKER_HOST", "DOCKER_CONFIG"].filter((name) => process.env[name]).map((name) => [name, process.env[name]]));
environment.COMPOSE_PARALLEL_LIMIT = "1";
const envFile = join(directory, "rehearsal.env");
const compose = ["compose", "--project-name", project, "--env-file", envFile, "--file", resolve("compose.yaml")];
const children = new Set();
let interrupted = false;
function interrupt() { interrupted = true; for (const child of children) child.kill("SIGINT"); }
process.on("SIGINT", interrupt);
process.on("SIGTERM", interrupt);
const budget = setTimeout(interrupt, 9 * 60_000);
let active;

async function run(args, { input, timeout = 60_000 } = {}) {
  if (interrupted) throw new Error("Rehearsal interrupted or time budget reached.");
  return new Promise((done, fail) => {
    const child = spawn(docker, args, { env: environment, stdio: ["pipe", "pipe", "pipe"] });
    children.add(child);
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
    const timer = setTimeout(() => child.kill("SIGTERM"), timeout);
    child.once("error", fail);
    child.once("close", (code) => {
      clearTimeout(timer); children.delete(child);
      code === 0 ? done(stdout) : fail(new Error(`Docker ${args[0]} failed (${code}): ${stderr.slice(-3500)}`));
    });
  });
}

async function request(path, method = "GET", body, headers = {}) {
  return fetch(`${origin}${path}`, { method, headers: { ...headers, ...(body === undefined ? {} : { "content-type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5_000) });
}
async function ready() {
  for (let attempt = 0; attempt < 45; attempt++) {
    if (interrupted) throw new Error("Rehearsal interrupted.");
    try { if ((await request("/healthz")).ok) return; } catch {}
    if (active?.exitCode !== null) throw new Error("Compose stopped before readiness.");
    await delay(1000);
  }
  throw new Error("The packaged server did not become ready.");
}
async function start() {
  active = spawn(docker, [...compose, "up", "--no-build"], { env: environment, stdio: ["ignore", "pipe", "pipe"] });
  children.add(active);
  let logs = "";
  active.stdout.on("data", (chunk) => { logs = (logs + chunk).slice(-20_000); });
  active.stderr.on("data", (chunk) => { logs = (logs + chunk).slice(-20_000); });
  active.once("close", () => { children.delete(active); });
  active.once("error", () => {});
  try { await ready(); } catch (error) { console.error(logs); throw error; }
}
async function stop() {
  if (!active || active.exitCode !== null || active.signalCode !== null) return;
  const child = active;
  child.kill("SIGINT");
  const force = setTimeout(() => child.kill("SIGTERM"), 15_000);
  await new Promise((done) => child.once("close", done));
  clearTimeout(force); active = undefined;
}
function passwordHash(password) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64")}$${scryptSync(password, salt, 64).toString("base64")}`;
}
const configuration = {
  POSTGRES_PASSWORD: randomBytes(32).toString("hex"), TODO_TRACKER_AUTH_MODE: "none",
  TODO_TRACKER_PUBLIC_ORIGIN: origin, TODO_TRACKER_ALLOW_UNAUTHENTICATED_REMOTE: "true",
};
async function configure() { await writeFile(envFile, Object.entries(configuration).map(([key, value]) => `${key}='${value}'`).join("\n"), { mode: 0o600 }); }
console.log(JSON.stringify({ project, port: 8888, command: "docker compose up --no-build", database: "disposable PostgreSQL 17", timeBudgetSeconds: 540 }));
try {
  await configure();
  console.log("Building the published container inputs...");
  await run([...compose, "build"], { timeout: 300_000 });
  await start();
  const installation = await (await request("/api/installation")).json();
  assert.equal(installation.authenticationMode, "none"); assert.equal(installation.workSwitch, false);
  assert.deepEqual(installation.integrations, { shortcut: false, granola: false, codex: false });
  const appID = (await run([...compose, "ps", "--quiet", "app"])).trim();
  const dbID = (await run([...compose, "ps", "--quiet", "database"])).trim();
  const [app] = JSON.parse(await run(["inspect", appID]));
  const [database] = JSON.parse(await run(["inspect", dbID]));
  assert.equal(app.Config.User, "node");
  assert.deepEqual(app.HostConfig.PortBindings["8888/tcp"], [{ HostIp: "127.0.0.1", HostPort: "8888" }]);
  assert.equal(Object.keys(database.HostConfig.PortBindings || {}).length, 0);
  console.log("PASS: non-root server, loopback-only app port, private database, no integration gates.");
  const created = await request("/api/tasks", "POST", { title: "Container release rehearsal" });
  assert.equal(created.status, 201); const { task } = await created.json();
  const edits = await Promise.all(["First edit", "Second edit"].map((notes) => request(`/api/tasks/${task.id}`, "PATCH", { notes, expectedUpdatedAt: task.updateToken })));
  assert.deepEqual(edits.map((response) => response.status).sort(), [200, 409]);
  assert.equal((await request(`/api/tasks/${task.id}`, "DELETE")).status, 204);
  assert.equal((await request(`/api/recovery/deleted/${task.id}/restore`, "POST")).status, 204);
  const backup = await (await request("/api/recovery/export")).json();
  assert(backup.tasks.some((item) => item.id === task.id));
  console.log("PASS: capture, concurrent edit conflict, deletion, restoration, JSON export.");
  const dump = await run([...compose, "exec", "-T", "database", "pg_dump", "-U", "todo_trackr", "-d", "todo_trackr", "--no-owner", "--no-acl"]);
  await run([...compose, "exec", "-T", "database", "createdb", "-U", "todo_trackr", "todo_trackr_restore"]);
  await run([...compose, "exec", "-T", "database", "psql", "-U", "todo_trackr", "-d", "todo_trackr_restore", "-v", "ON_ERROR_STOP=1"], { input: dump });
  assert.equal((await run([...compose, "exec", "-T", "database", "psql", "-U", "todo_trackr", "-d", "todo_trackr_restore", "-Atc", "SELECT count(*) FROM tasks WHERE title='Container release rehearsal'"])).trim(), "1");
  console.log("PASS: PostgreSQL dump restored into an independent database.");
  await request(`/api/tasks/${task.id}`, "PATCH", { alarmAt: new Date(Date.now() + 1500).toISOString() });
  await stop();
  await delay(1800);
  await start();
  let alarm;
  for (let attempt = 0; attempt < 20; attempt++) {
    alarm = (await (await request("/api/tasks")).json()).tasks.find((item) => item.id === task.id);
    if (alarm?.alarmNotifiedAt) break;
    await delay(1000);
  }
  assert(alarm?.alarmNotifiedAt);
  await request(`/api/tasks/${task.id}`, "PATCH", { clearAlarm: true });
  console.log("PASS: persistent task/alarm after restart and idempotent migrations.");
  await stop();
  configuration.TODO_TRACKER_AUTH_MODE = "password";
  configuration.TODO_TRACKER_PASSWORD_HASH = passwordHash("disposable-rehearsal-password");
  configuration.SESSION_SIGNING_SECRET = randomBytes(32).toString("hex");
  await configure(); await start();
  for (const path of ["/api/tasks", "/api/lists", "/api/recovery/export", "/api/system-health"]) assert.equal((await request(path)).status, 401);
  assert.equal((await request("/api/auth/login", "POST", { password: "incorrect" })).status, 401);
  const login = await request("/api/auth/login", "POST", { password: "disposable-rehearsal-password" });
  assert.equal(login.status, 200); const cookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal((await request("/api/tasks", "GET", undefined, { cookie })).status, 200);
  console.log("PASS: password-mode switch, unauthorized protection, wrong-password rejection, real session cookie.");
} finally {
  clearTimeout(budget);
  await stop();
  // Only this random, newly created project's disposable resources are removed.
  interrupted = false;
  try { await run([...compose, "down", "--volumes", "--remove-orphans"]); }
  finally { await rm(directory, { recursive: true, force: true }); }
  process.removeListener("SIGINT", interrupt); process.removeListener("SIGTERM", interrupt);
  console.log("Rehearsal stopped; task containers, network, volumes, and temporary configuration removed.");
}

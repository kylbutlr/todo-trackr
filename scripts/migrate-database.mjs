import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Pool } from "pg";

if (process.env.TODO_TRACKER_RUNTIME !== "standalone") throw new Error("Set TODO_TRACKER_RUNTIME=standalone before migrating a self-hosted database.");
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL for the intended self-hosted database.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000 });
const client = await pool.connect();
try {
  await client.query("SELECT pg_advisory_lock(hashtext('todo-trackr-migrations'))");
  const names = (await readdir("database/migrations")).filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/u.test(name)).sort();
  const { rows: relations } = await client.query("SELECT to_regclass('public.tasks') AS tasks, to_regclass('public.schema_migrations') AS ledger, to_regclass('public.todo_tracker_migrations') AS checksums");
  if (relations[0].tasks && !relations[0].ledger && !relations[0].checksums) throw new Error("Legacy database has no migration ledger. Apply the documented legacy migrations before using this runner.");
  const baseline = relations[0].ledger ? Number((await client.query("SELECT coalesce(max(version),0) AS version FROM schema_migrations")).rows[0].version) : 0;
  await client.query("CREATE TABLE IF NOT EXISTS todo_tracker_migrations (version integer PRIMARY KEY, name text NOT NULL, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
  for (const [index, name] of names.entries()) {
    const version = index + 1;
    if (!name.startsWith(String(version).padStart(4, "0"))) throw new Error("Migration sequence is not contiguous.");
    const source = await readFile(`database/migrations/${name}`, "utf8");
    const checksum = createHash("sha256").update(source).digest("hex");
    const previous = (await client.query("SELECT checksum FROM todo_tracker_migrations WHERE version=$1", [version])).rows[0];
    if (previous) {
      if (previous.checksum !== checksum) throw new Error(`Previously applied migration changed: ${name}`);
      continue;
    }
    if (!/^BEGIN;[\s\S]*COMMIT;\s*$/u.test(source.trim())) throw new Error(`Migration must be transaction wrapped: ${name}`);
    await client.query("BEGIN");
    try {
      if (version > baseline) await client.query(source.trim().replace(/^BEGIN;/u, "").replace(/COMMIT;\s*$/u, ""));
      await client.query("INSERT INTO todo_tracker_migrations(version,name,checksum) VALUES($1,$2,$3)", [version, name, checksum]);
      await client.query("COMMIT");
      console.log(`${version <= baseline ? "Recorded existing" : "Applied"} migration ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  try { await client.query("SELECT pg_advisory_unlock(hashtext('todo-trackr-migrations'))"); } finally { client.release(); await pool.end(); }
}

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const migrationDirectory = path.resolve("database/migrations");
const entries = (await readdir(migrationDirectory))
  .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/u.test(name))
  .sort();

if (entries.length === 0) {
  throw new Error("No database migrations were found.");
}

for (const [index, name] of entries.entries()) {
  const expected = String(index + 1).padStart(4, "0");
  if (!name.startsWith(`${expected}_`)) {
    throw new Error(`Migration sequence is not contiguous. Expected ${expected}, found ${name}.`);
  }

  const source = await readFile(path.join(migrationDirectory, name), "utf8");
  if (!/^BEGIN;[\s\S]*COMMIT;\s*$/u.test(source.trim())) {
    throw new Error(`${name} must be wrapped in BEGIN and COMMIT.`);
  }
}

const latestVersion = entries.length;
const ledgerMigration = entries.find((name) => name.includes("system_health_and_recovery"));
if (!ledgerMigration) {
  throw new Error("The schema migration ledger bootstrap is missing.");
}

const latestMigration = entries.at(-1);
const latestSource = await readFile(path.join(migrationDirectory, latestMigration), "utf8");
if (!latestSource.includes(`(${latestVersion}, '`)) {
  throw new Error(`${latestMigration} must record schema migration version ${latestVersion}.`);
}

console.log(`Verified ${entries.length} contiguous database migrations through ${entries.at(-1)}.`);

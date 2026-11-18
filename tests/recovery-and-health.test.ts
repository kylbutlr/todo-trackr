import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { BACKUP_VERSION, backupImportSchema } from "../netlify/functions/lib/recovery.js";
import { REQUIRED_SCHEMA_VERSION } from "../netlify/functions/lib/system-health.js";

const ledgerMigration = readFileSync(
  new URL("../database/migrations/0013_system_health_and_recovery.sql", import.meta.url),
  "utf8",
);
const latestMigration = readFileSync(
  new URL("../database/migrations/0017_granola_schedule_settings.sql", import.meta.url),
  "utf8",
);
const tasks = readFileSync(
  new URL("../netlify/functions/lib/tasks.ts", import.meta.url),
  "utf8",
);
const recovery = readFileSync(
  new URL("../netlify/functions/lib/recovery.ts", import.meta.url),
  "utf8",
);

describe("system health and recovery", () => {
  it("keeps the required schema version aligned with the ledger migration", () => {
    expect(REQUIRED_SCHEMA_VERSION).toBe(17);
    expect(ledgerMigration).toContain("(13, 'system_health_and_recovery')");
    expect(ledgerMigration).toContain("ADD COLUMN IF NOT EXISTS deleted_at timestamptz");
    expect(latestMigration).toContain("(17, 'granola_schedule_settings')");
    expect(latestMigration).toContain("ADD COLUMN IF NOT EXISTS scan_interval_minutes integer NOT NULL DEFAULT 15");
    expect(latestMigration).toContain("ADD COLUMN IF NOT EXISTS scan_offset_minutes integer NOT NULL DEFAULT 0");
  });

  it("reports web and Sparkle release metadata without exposing secrets", () => {
    const systemHealth = readFileSync(
      new URL("../netlify/functions/lib/system-health.ts", import.meta.url),
      "utf8",
    );
    expect(systemHealth).toContain("sparkleVersion: packageMetadata.version");
    expect(systemHealth).toContain("sparkleBuild: macosBuildNumber(packageMetadata.version)");
    expect(systemHealth).toContain("Boolean(process.env[name]?.trim())");
  });

  it("soft deletes Tasks and excludes them from normal snapshots", () => {
    expect(tasks).toContain("SET deleted_at = now(), alarm_trigger_run_id = NULL, updated_at = now()");
    expect(tasks).toContain("WHERE tasks.deleted_at IS NULL");
  });

  it("accepts a versioned JSON backup envelope", () => {
    const exportedAt = "2026-08-21T12:00:00Z";
    expect(backupImportSchema.parse({
      version: BACKUP_VERSION,
      exportedAt,
      appVersion: "0.2.46",
      lists: [],
      tasks: [],
    })).toEqual({
      version: 1,
      exportedAt,
      appVersion: "0.2.46",
      lists: [],
      tasks: [],
    });
  });

  it("restores only missing records and skips Shortcut-managed Tasks", () => {
    expect(recovery).toContain("ON CONFLICT (id) DO NOTHING");
    expect(recovery).toContain('z.enum(["manual", "browser", "granola", "slack", "gmail"])');
    expect(recovery).toContain('mode: "only_missing" as const');
  });
});

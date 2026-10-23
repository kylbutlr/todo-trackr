import packageMetadata from "../../../package.json" with { type: "json" };

import { database } from "./database.js";
import { authenticationMode, integrationEnabled, isStandalone } from "./installation.js";

export const REQUIRED_SCHEMA_VERSION = 17;

const requiredEnvironment = [
  "DATABASE_URL",
  "TODO_TRACKER_PASSWORD_HASH",
  "SESSION_SIGNING_SECRET",
  "SHORTCUT_API_TOKEN",
  "SHORTCUT_WEBHOOK_SECRET",
  "TODO_TRACKR_INGEST_TOKEN",
  "GRANOLA_API_KEY",
  "GRANOLA_WEBHOOK_SECRET",
  "TRIGGER_SECRET_KEY",
] as const;

const optionalEnvironment = [
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "TODO_TRACKER_SHORTCUT_REPAIR_ENABLED",
  "TODO_TRACKER_GRANOLA_REPAIR_ENABLED",
] as const;

type DateValue = Date | string | null;

type MigrationRow = {
  version: number;
  name: string;
  applied_at: DateValue;
};

type ConnectionRow = {
  source: string;
  name: string;
  paused: boolean;
  health: "healthy" | "syncing" | "degraded" | "failed" | "paused";
  last_success_at: DateValue;
  last_failure_at: DateValue;
  last_failure_message: string | null;
  latest_run_at: DateValue;
  latest_run_status: "running" | "succeeded" | "failed" | null;
  scan_interval_minutes: number | null;
};

function nullableIso(value: DateValue): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function environmentPresence(names: readonly string[]) {
  return Object.fromEntries(names.map((name) => [name, Boolean(process.env[name]?.trim())]));
}

function macosBuildNumber(version: string): string {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/u);
  if (!match) return "unknown";
  const [, major, minor, patch] = match.map(Number);
  return String((major * 1_000_000) + (minor * 1_000) + patch);
}

function isMissingRelation(error: unknown): boolean {
  return error instanceof Error && /schema_migrations|does not exist|undefined table/iu.test(error.message);
}

export type SystemHealthSnapshot = {
  generatedAt: string;
  status: "healthy" | "attention";
  schema: {
    currentVersion: number | null;
    requiredVersion: number;
    current: boolean;
    appliedAt: string | null;
    message: string;
  };
  environment: {
    required: Record<string, boolean>;
    optional: Record<string, boolean>;
    requiredConfigured: boolean;
  };
  deployment: {
    webVersion: string;
    sparkleVersion: string;
    sparkleBuild: string;
    commitRef: string | null;
    deployId: string | null;
    context: string | null;
  };
  connections: Array<{
    source: string;
    name: string;
    paused: boolean;
    health: ConnectionRow["health"];
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    lastFailureMessage: string | null;
    latestRunAt: string | null;
    latestRunStatus: ConnectionRow["latest_run_status"];
    schedulerFreshness: "fresh" | "stale" | "not_applicable" | "unknown";
    expectedWithinMinutes: number | null;
  }>;
};

export function schedulerExpectedWithinMinutes(source: string, repairEnabled: boolean): number | null {
  if (!repairEnabled) return null;
  if (source === "shortcut" || source === "granola") return 12 * 60;
  return null;
}

function scheduledRepairIsEnabled(source: string): boolean {
  const variable = source === "shortcut"
    ? "TODO_TRACKER_SHORTCUT_REPAIR_ENABLED"
    : source === "granola"
      ? "TODO_TRACKER_GRANOLA_REPAIR_ENABLED"
      : null;
  return variable === null || process.env[variable]?.trim().toLowerCase() !== "false";
}

export async function loadSystemHealth(now = new Date()): Promise<SystemHealthSnapshot> {
  const activeRequired = isStandalone()
    ? ["DATABASE_URL", ...(authenticationMode() === "password" ? ["TODO_TRACKER_PASSWORD_HASH", "SESSION_SIGNING_SECRET"] : [])]
    : requiredEnvironment;
  const required = environmentPresence(activeRequired);
  const optional = environmentPresence(isStandalone() ? optionalEnvironment.filter((name) => name.startsWith("VAPID_")) : optionalEnvironment);
  const requiredConfigured = Object.values(required).every(Boolean);
  const sql = database();

  let migration: MigrationRow | undefined;
  try {
    const migrations = await sql`
      SELECT version, name, applied_at
      FROM schema_migrations
      ORDER BY version DESC
      LIMIT 1
    ` as unknown as MigrationRow[];
    migration = migrations[0];
  } catch (error) {
    if (!isMissingRelation(error)) throw error;
  }

  const connectionRows = await sql`
    SELECT
      connections.source,
      connections.name,
      connections.paused,
      connections.health,
      connections.last_success_at,
      connections.last_failure_at,
      connections.last_failure_message,
      connections.scan_interval_minutes,
      latest.started_at AS latest_run_at,
      latest.status AS latest_run_status
    FROM source_connections AS connections
    LEFT JOIN LATERAL (
      SELECT runs.started_at, runs.status
      FROM connection_sync_runs AS runs
      WHERE runs.connection_id = connections.id
      ORDER BY runs.started_at DESC
      LIMIT 1
    ) AS latest ON true
    ORDER BY connections.name ASC
  ` as unknown as ConnectionRow[];

  const currentVersion = migration?.version ?? null;
  const schemaCurrent = currentVersion === REQUIRED_SCHEMA_VERSION;
  const connections = connectionRows.filter((row) => !["shortcut", "granola", "codex"].includes(row.source)
    || integrationEnabled(row.source as "shortcut" | "granola" | "codex")).map((row) => {
    const expectedWithinMinutes = schedulerExpectedWithinMinutes(
      row.source,
      scheduledRepairIsEnabled(row.source),
    );
    const latestRunAt = nullableIso(row.latest_run_at);
    const latestRunAge = latestRunAt ? now.getTime() - new Date(latestRunAt).getTime() : null;
    const schedulerFreshness = expectedWithinMinutes === null
      ? "not_applicable" as const
      : row.paused
        ? "not_applicable" as const
        : latestRunAge === null
          ? "unknown" as const
          : latestRunAge <= expectedWithinMinutes * 60_000
            ? "fresh" as const
            : "stale" as const;
    return {
      source: row.source,
      name: row.name,
      paused: row.paused,
      health: row.health,
      lastSuccessAt: nullableIso(row.last_success_at),
      lastFailureAt: nullableIso(row.last_failure_at),
      lastFailureMessage: row.last_failure_message,
      latestRunAt,
      latestRunStatus: row.latest_run_status,
      schedulerFreshness,
      expectedWithinMinutes,
    };
  });
  const connectionAttention = connections.some((connection) => (
    connection.health === "degraded"
    || connection.health === "failed"
    || connection.schedulerFreshness === "stale"
  ));

  return {
    generatedAt: now.toISOString(),
    status: schemaCurrent && requiredConfigured && !connectionAttention ? "healthy" : "attention",
    schema: {
      currentVersion,
      requiredVersion: REQUIRED_SCHEMA_VERSION,
      current: schemaCurrent,
      appliedAt: nullableIso(migration?.applied_at ?? null),
      message: schemaCurrent
        ? "Database schema is current."
        : `Apply database migrations through ${String(REQUIRED_SCHEMA_VERSION).padStart(4, "0")}.`,
    },
    environment: { required, optional, requiredConfigured },
    deployment: {
      webVersion: packageMetadata.version,
      sparkleVersion: packageMetadata.version,
      sparkleBuild: macosBuildNumber(packageMetadata.version),
      commitRef: process.env.COMMIT_REF?.trim() || null,
      deployId: process.env.DEPLOY_ID?.trim() || null,
      context: process.env.CONTEXT?.trim() || null,
    },
    connections,
  };
}

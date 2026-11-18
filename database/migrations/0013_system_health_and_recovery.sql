BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version integer PRIMARY KEY CHECK (version > 0),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  applied_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations (version, name)
VALUES
  (1, 'initial'),
  (2, 'lists'),
  (3, 'automation_foundation'),
  (4, 'granola_ingest'),
  (5, 'connection_sync_modes'),
  (6, 'shortcut_polling'),
  (7, 'web_push'),
  (8, 'shortcut_rule_v2_shadow'),
  (9, 'granola_reliability'),
  (10, 'task_stars'),
  (11, 'shortcut_board'),
  (12, 'codex_sessions'),
  (13, 'system_health_and_recovery')
ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS tasks_deleted_at_idx
  ON tasks (deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS recovery_runs (
  id uuid PRIMARY KEY,
  backup_version integer NOT NULL CHECK (backup_version > 0),
  mode text NOT NULL CHECK (mode IN ('only_missing')),
  restored_lists integer NOT NULL DEFAULT 0 CHECK (restored_lists >= 0),
  restored_tasks integer NOT NULL DEFAULT 0 CHECK (restored_tasks >= 0),
  skipped_tasks integer NOT NULL DEFAULT 0 CHECK (skipped_tasks >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;

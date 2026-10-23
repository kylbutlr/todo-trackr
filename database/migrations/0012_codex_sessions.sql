BEGIN;

ALTER TABLE source_connections
  DROP CONSTRAINT IF EXISTS source_connections_source_check;

ALTER TABLE source_connections
  ADD CONSTRAINT source_connections_source_check
  CHECK (source IN ('shortcut', 'granola', 'slack', 'gmail', 'codex'));

INSERT INTO source_connections (id, source, name, paused, health)
VALUES (
  '00000000-0000-4000-8000-000000000500',
  'codex',
  'Codex',
  false,
  'healthy'
)
ON CONFLICT (source) DO NOTHING;

CREATE TABLE IF NOT EXISTS codex_sessions (
  id uuid PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  thread_id text NOT NULL UNIQUE CHECK (char_length(btrim(thread_id)) BETWEEN 1 AND 500),
  thread_url text,
  title text CHECK (title IS NULL OR char_length(btrim(title)) BETWEEN 1 AND 500),
  status text NOT NULL DEFAULT 'linked'
    CHECK (status IN ('linked', 'queued', 'working', 'waiting_for_you', 'ready_for_review', 'failed', 'finished')),
  latest_summary text,
  cwd text,
  branch_name text,
  pr_url text,
  is_current boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS codex_sessions_one_current_per_task_idx
  ON codex_sessions (task_id)
  WHERE is_current;

CREATE INDEX IF NOT EXISTS codex_sessions_status_time_idx
  ON codex_sessions (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS codex_sessions_task_time_idx
  ON codex_sessions (task_id, updated_at DESC);

COMMIT;

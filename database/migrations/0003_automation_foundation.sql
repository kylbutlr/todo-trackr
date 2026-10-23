BEGIN;

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_priority_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_priority_check
  CHECK (priority IN ('none', 'lowest', 'low', 'medium', 'high', 'highest'));

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_status_check,
  DROP CONSTRAINT IF EXISTS tasks_completion_consistency;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('open', 'completed', 'archived')),
  ADD CONSTRAINT tasks_completion_consistency CHECK (
    (status = 'open' AND completed_at IS NULL AND archived_at IS NULL)
    OR
    (status = 'completed' AND completed_at IS NOT NULL AND archived_at IS NULL)
    OR
    (status = 'archived' AND completed_at IS NULL AND archived_at IS NOT NULL)
  );

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_url text;

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_source_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_source_check
  CHECK (source IN ('manual', 'browser', 'shortcut', 'slack', 'gmail'));

CREATE TABLE IF NOT EXISTS source_connections (
  id uuid PRIMARY KEY,
  source text NOT NULL UNIQUE CHECK (source IN ('shortcut', 'slack', 'gmail')),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  paused boolean NOT NULL DEFAULT true,
  health text NOT NULL DEFAULT 'paused'
    CHECK (health IN ('healthy', 'syncing', 'degraded', 'failed', 'paused')),
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_failure_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_rules (
  id uuid PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES source_connections(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 150),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, slug)
);

CREATE TABLE IF NOT EXISTS automation_rule_versions (
  rule_id uuid NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('proposed', 'active', 'retired')),
  config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  PRIMARY KEY (rule_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS automation_rule_versions_one_active_idx
  ON automation_rule_versions (rule_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS source_objects (
  id uuid PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES source_connections(id) ON DELETE CASCADE,
  external_reference text NOT NULL,
  source_url text NOT NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 1000),
  content_fingerprint text NOT NULL,
  source_fingerprint text NOT NULL,
  source_summary text,
  source_summary_fingerprint text,
  priority text NOT NULL DEFAULT 'none'
    CHECK (priority IN ('none', 'lowest', 'low', 'medium', 'high', 'highest')),
  size text CHECK (size IN ('S', 'M', 'L', 'XL')),
  due_date date,
  owner_ids uuid[] NOT NULL DEFAULT '{}',
  workflow_state_id bigint,
  workflow_state_name text,
  source_archived boolean NOT NULL DEFAULT false,
  source_updated_at timestamptz,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_reference)
);

CREATE TABLE IF NOT EXISTS automated_task_links (
  task_id uuid PRIMARY KEY REFERENCES tasks(id) ON DELETE RESTRICT,
  source_object_id uuid NOT NULL REFERENCES source_objects(id) ON DELETE RESTRICT,
  rule_id uuid NOT NULL REFERENCES automation_rules(id) ON DELETE RESTRICT,
  rule_version integer NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (rule_id, rule_version)
    REFERENCES automation_rule_versions(rule_id, version) ON DELETE RESTRICT,
  UNIQUE (source_object_id, rule_id)
);

CREATE TABLE IF NOT EXISTS automation_activity (
  id uuid PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
  connection_id uuid NOT NULL REFERENCES source_connections(id) ON DELETE RESTRICT,
  rule_id uuid NOT NULL,
  rule_version integer NOT NULL,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'completed', 'reopened', 'archived')),
  reason text NOT NULL,
  source_observation jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (rule_id, rule_version)
    REFERENCES automation_rule_versions(rule_id, version) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS automation_activity_task_time_idx
  ON automation_activity (task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS connection_sync_runs (
  id uuid PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES source_connections(id) ON DELETE CASCADE,
  trigger text NOT NULL
    CHECK (trigger IN ('preview', 'manual', 'webhook', 'scheduled', 'resume', 'rule_change')),
  mode text NOT NULL CHECK (mode IN ('preview', 'apply')),
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  counts jsonb NOT NULL DEFAULT '{}',
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS connection_sync_runs_connection_time_idx
  ON connection_sync_runs (connection_id, started_at DESC);

CREATE INDEX IF NOT EXISTS tasks_source_status_idx
  ON tasks (source, status, created_at DESC);

INSERT INTO source_connections (id, source, name, paused, health)
VALUES (
  '00000000-0000-4000-8000-000000000100',
  'shortcut',
  'Shortcut',
  true,
  'paused'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO automation_rules (id, connection_id, slug, name)
VALUES (
  '00000000-0000-4000-8000-000000000110',
  '00000000-0000-4000-8000-000000000100',
  'direct-shortcut-responsibility',
  'Direct Shortcut Responsibility'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO automation_rule_versions (rule_id, version, status, config, activated_at)
VALUES (
  '00000000-0000-4000-8000-000000000110',
  1,
  'active',
  '{
    "member_id": "5d8264c4-151d-48ca-9f1a-ed042cf4780f",
    "active_states": {
      "500130360": "Triage",
      "500130669": "Triage In Progress",
      "500130177": "Ready for LOE",
      "500000056": "Ready for Development",
      "500000051": "In Progress",
      "500127059": "Pending Eng"
    },
    "completion_states": {
      "500019424": "Pending Ops",
      "500130176": "Pending Client",
      "500130165": "Agentic QA",
      "500130660": "QA In Progress",
      "500130980": "CSM Review",
      "500000081": "QA in Staging",
      "500000079": "Production Approved",
      "500058674": "Deployed",
      "500000055": "Completed"
    },
    "completion_precedes_unassignment": true
  }'::jsonb,
  now()
)
ON CONFLICT (rule_id, version) DO NOTHING;

COMMIT;

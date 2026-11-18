BEGIN;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS alarm_at timestamptz,
  ADD COLUMN IF NOT EXISTS alarm_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS alarm_cleared_at timestamptz;

CREATE INDEX IF NOT EXISTS tasks_due_alarm_idx
  ON tasks (alarm_at)
  WHERE deleted_at IS NULL
    AND status = 'open'
    AND alarm_at IS NOT NULL
    AND alarm_cleared_at IS NULL;

INSERT INTO schema_migrations (version, name)
VALUES (15, 'task_attention_alarms')
ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name;

COMMIT;

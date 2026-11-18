BEGIN;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS alarm_trigger_run_id text;

INSERT INTO schema_migrations (version, name)
VALUES (16, 'trigger_task_alarms')
ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name;

COMMIT;

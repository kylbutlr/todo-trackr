BEGIN;

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_source_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_source_check
  CHECK (source IN ('manual', 'browser', 'shortcut', 'granola', 'slack', 'gmail'));

ALTER TABLE source_connections
  DROP CONSTRAINT IF EXISTS source_connections_source_check;

ALTER TABLE source_connections
  ADD CONSTRAINT source_connections_source_check
  CHECK (source IN ('shortcut', 'granola', 'slack', 'gmail'));

INSERT INTO source_connections (id, source, name, paused, health)
VALUES (
  '00000000-0000-4000-8000-000000000200',
  'granola',
  'Granola',
  false,
  'healthy'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO automation_rules (id, connection_id, slug, name)
VALUES (
  '00000000-0000-4000-8000-000000000210',
  '00000000-0000-4000-8000-000000000200',
  'granola-next-steps-for-kyle',
  'Granola Next Steps for Kyle'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO automation_rule_versions (rule_id, version, status, config, activated_at)
VALUES (
  '00000000-0000-4000-8000-000000000210',
  1,
  'active',
  '{
    "responsibility_phrases": ["Kyle", "Me"],
    "lifecycle": "manual_after_capture",
    "idempotency": "external_reference"
  }'::jsonb,
  now()
)
ON CONFLICT (rule_id, version) DO NOTHING;

COMMIT;

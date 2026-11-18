BEGIN;

ALTER TABLE source_objects
  ADD COLUMN IF NOT EXISTS epic_id bigint,
  ADD COLUMN IF NOT EXISTS epic_name text;

INSERT INTO schema_migrations (version, name)
VALUES (14, 'shortcut_epic_metadata')
ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name;

COMMIT;

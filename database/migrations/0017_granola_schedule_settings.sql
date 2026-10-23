BEGIN;

ALTER TABLE source_connections
  ADD COLUMN IF NOT EXISTS scan_interval_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS scan_offset_minutes integer NOT NULL DEFAULT 0;

ALTER TABLE source_connections
  DROP CONSTRAINT IF EXISTS source_connections_granola_schedule_check;

ALTER TABLE source_connections
  ADD CONSTRAINT source_connections_granola_schedule_check
  CHECK (
    source <> 'granola'
    OR (
      scan_interval_minutes IN (5, 10, 15, 30, 60)
      AND scan_offset_minutes >= 0
      AND scan_offset_minutes < scan_interval_minutes
      AND mod(scan_offset_minutes, 5) = 0
    )
  );

INSERT INTO schema_migrations (version, name)
VALUES (17, 'granola_schedule_settings')
ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name;

COMMIT;

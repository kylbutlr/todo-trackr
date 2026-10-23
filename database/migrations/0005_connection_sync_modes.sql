BEGIN;

ALTER TABLE source_connections
  ADD COLUMN IF NOT EXISTS sync_mode text NOT NULL DEFAULT 'review';

ALTER TABLE source_connections
  DROP CONSTRAINT IF EXISTS source_connections_sync_mode_check;

ALTER TABLE source_connections
  ADD CONSTRAINT source_connections_sync_mode_check
  CHECK (sync_mode IN ('review', 'automatic'));

CREATE TABLE IF NOT EXISTS source_webhook_events (
  id text PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES source_connections(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('processing', 'succeeded', 'ignored', 'failed')),
  story_references text[] NOT NULL DEFAULT '{}',
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS source_webhook_events_connection_time_idx
  ON source_webhook_events (connection_id, received_at DESC);

COMMIT;

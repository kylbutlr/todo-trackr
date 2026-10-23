BEGIN;

CREATE TABLE IF NOT EXISTS granola_review_candidates (
  id text PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES source_connections(id) ON DELETE CASCADE,
  note_id text NOT NULL,
  external_reference text NOT NULL UNIQUE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 500),
  notes text NOT NULL DEFAULT '',
  source_url text NOT NULL,
  source_excerpt text NOT NULL,
  source_updated_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'dismissed', 'stale')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS granola_review_candidates_status_time_idx
  ON granola_review_candidates (status, last_seen_at DESC);

COMMIT;

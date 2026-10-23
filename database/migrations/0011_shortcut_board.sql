BEGIN;

CREATE TABLE IF NOT EXISTS shortcut_board_preferences (
  external_reference text PRIMARY KEY,
  is_starred boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shortcut_board_preferences_starred_idx
  ON shortcut_board_preferences (updated_at DESC)
  WHERE is_starred = true;

COMMIT;

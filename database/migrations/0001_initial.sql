BEGIN;

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 500),
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed')),
  priority text NOT NULL DEFAULT 'none' CHECK (priority IN ('none', 'low', 'medium', 'high')),
  due_at timestamptz,
  sort_order bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT tasks_completion_consistency CHECK (
    (status = 'open' AND completed_at IS NULL)
    OR
    (status = 'completed' AND completed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS tasks_status_sort_order_idx
  ON tasks (status, sort_order, created_at DESC);

CREATE INDEX IF NOT EXISTS tasks_due_at_idx
  ON tasks (due_at)
  WHERE due_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fingerprint text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_attempts_fingerprint_time_idx
  ON auth_attempts (fingerprint, attempted_at DESC);

COMMIT;

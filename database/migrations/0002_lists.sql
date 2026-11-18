BEGIN;

CREATE TABLE IF NOT EXISTS task_lists (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  sort_order bigint NOT NULL DEFAULT 0,
  is_inbox boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS task_lists_single_inbox_idx
  ON task_lists (is_inbox)
  WHERE is_inbox;

CREATE UNIQUE INDEX IF NOT EXISTS task_lists_name_idx
  ON task_lists (lower(name));

INSERT INTO task_lists (id, name, sort_order, is_inbox)
VALUES ('00000000-0000-4000-8000-000000000001', 'Inbox', -1, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS list_id uuid REFERENCES task_lists(id) ON DELETE RESTRICT;

UPDATE tasks
SET list_id = '00000000-0000-4000-8000-000000000001'
WHERE list_id IS NULL;

ALTER TABLE tasks
  ALTER COLUMN list_id SET DEFAULT '00000000-0000-4000-8000-000000000001',
  ALTER COLUMN list_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS tasks_list_status_idx
  ON tasks (list_id, status, sort_order, created_at DESC);

COMMIT;

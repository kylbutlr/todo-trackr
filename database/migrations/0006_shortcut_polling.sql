BEGIN;

ALTER TABLE connection_sync_runs
  DROP CONSTRAINT IF EXISTS connection_sync_runs_trigger_check;

ALTER TABLE connection_sync_runs
  ADD CONSTRAINT connection_sync_runs_trigger_check
  CHECK (trigger IN ('preview', 'manual', 'webhook', 'poll', 'scheduled', 'resume', 'rule_change'));

COMMIT;

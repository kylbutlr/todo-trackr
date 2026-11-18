BEGIN;

INSERT INTO automation_rule_versions (rule_id, version, status, config)
VALUES (
  '00000000-0000-4000-8000-000000000110',
  2,
  'proposed',
  '{
    "member_id": "5d8264c4-151d-48ca-9f1a-ed042cf4780f",
    "responsibility_reasons": ["assigned", "requester", "description_request", "comment_request"],
    "ignored_reasons": ["follower", "parent_epic", "label", "custom_field"],
    "hold_states": {
      "500130165": "Agentic QA",
      "500130660": "QA In Progress"
    },
    "completion_states": {
      "500019424": "Pending Ops",
      "500130176": "Pending Client",
      "500130980": "CSM Review",
      "500000081": "QA in Staging",
      "500000079": "Production Approved",
      "500058674": "Deployed",
      "500000055": "Completed"
    },
    "requester_salience": "background",
    "comment_request_salience": "heads_up",
    "comment_response_completion": true,
    "shadow_only": true
  }'::jsonb
)
ON CONFLICT (rule_id, version) DO UPDATE SET
  status = 'proposed',
  config = EXCLUDED.config,
  activated_at = NULL;

CREATE TABLE IF NOT EXISTS automation_rule_shadow_observations (
  id uuid PRIMARY KEY,
  rule_id uuid NOT NULL,
  rule_version integer NOT NULL,
  external_reference text NOT NULL,
  source_url text NOT NULL,
  title text NOT NULL,
  workflow_state_name text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('open', 'hold', 'complete', 'ignore')),
  salience text NOT NULL CHECK (salience IN ('primary', 'heads_up', 'background')),
  reasons jsonb NOT NULL,
  reason_summary text NOT NULL,
  fingerprint text NOT NULL,
  source_updated_at timestamptz,
  observed_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (rule_id, rule_version)
    REFERENCES automation_rule_versions(rule_id, version) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS automation_rule_shadow_latest_idx
  ON automation_rule_shadow_observations (
    rule_id,
    rule_version,
    external_reference,
    observed_at DESC
  );

COMMIT;

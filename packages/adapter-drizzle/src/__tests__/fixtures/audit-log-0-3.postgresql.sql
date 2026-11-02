-- The audit table FlowPanel 0.3's 0001_init.sql created, before actor_name and scope_key.

CREATE TABLE IF NOT EXISTS flowpanel_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text,
  action text NOT NULL,
  resource text,
  target_id text,
  diff jsonb,
  ip text,
  user_agent text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flowpanel_audit_log_at_idx ON flowpanel_audit_log (at DESC);
CREATE INDEX IF NOT EXISTS flowpanel_audit_log_actor_idx ON flowpanel_audit_log (actor_id, at DESC);

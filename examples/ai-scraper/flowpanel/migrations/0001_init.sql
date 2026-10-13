-- The migrate bookkeeping table, and the audit log the admin writes when `audit` is on without a `sink`.

CREATE TABLE IF NOT EXISTS _flowpanel_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flowpanel_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text,
  actor_name text,
  action text NOT NULL,
  resource text,
  target_id text,
  diff jsonb,
  ip text,
  user_agent text,
  scope_key text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flowpanel_audit_log_at_idx ON flowpanel_audit_log (at DESC);
CREATE INDEX IF NOT EXISTS flowpanel_audit_log_actor_idx ON flowpanel_audit_log (actor_id, at DESC);
CREATE INDEX IF NOT EXISTS flowpanel_audit_log_target_idx ON flowpanel_audit_log (resource, target_id, at DESC);
CREATE INDEX IF NOT EXISTS flowpanel_audit_log_scope_idx ON flowpanel_audit_log (scope_key, at DESC);

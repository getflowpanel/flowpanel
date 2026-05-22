-- FlowPanel M1 baseline — Postgres flavour.
-- Adjust for MySQL / SQLite manually until the adapter emits dialect-specific SQL (M2+).

CREATE TABLE IF NOT EXISTS _flowpanel_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

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

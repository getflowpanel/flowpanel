-- The audit table FlowPanel 0.3's 0001_init.sql created, before actor_name and scope_key.

CREATE TABLE IF NOT EXISTS flowpanel_audit_log (
  id text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  actor_id text,
  action text NOT NULL,
  resource text,
  target_id text,
  diff text,
  ip text,
  user_agent text,
  at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS flowpanel_audit_log_at_idx ON flowpanel_audit_log (at DESC);
CREATE INDEX IF NOT EXISTS flowpanel_audit_log_actor_idx ON flowpanel_audit_log (actor_id, at DESC);

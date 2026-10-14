-- The audit table FlowPanel 0.3's 0001_init.sql created, before actor_name and scope_key.

CREATE TABLE IF NOT EXISTS flowpanel_audit_log (
  id char(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  actor_id varchar(255),
  action varchar(255) NOT NULL,
  resource varchar(255),
  target_id varchar(255),
  diff json,
  ip varchar(45),
  user_agent text,
  at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX flowpanel_audit_log_at_idx (at DESC),
  INDEX flowpanel_audit_log_actor_idx (actor_id, at DESC)
);

-- The bounded copy of each audit diff that History and the Audit log read, for a table 0001 already created.

ALTER TABLE flowpanel_audit_log ADD COLUMN IF NOT EXISTS diff_preview jsonb;
UPDATE flowpanel_audit_log SET diff_preview = diff WHERE diff_preview IS NULL AND diff IS NOT NULL AND octet_length(diff::text) <= 8192;
UPDATE flowpanel_audit_log SET diff_preview = jsonb_build_object('__flowpanelTooLarge', jsonb_build_object(
  'before', CASE WHEN jsonb_typeof(diff -> 'before') = 'object' THEN (SELECT coalesce(jsonb_agg(k), '[]'::jsonb) FROM jsonb_object_keys(diff -> 'before') AS k) END,
  'after', CASE WHEN jsonb_typeof(diff -> 'after') = 'object' THEN (SELECT coalesce(jsonb_agg(k), '[]'::jsonb) FROM jsonb_object_keys(diff -> 'after') AS k) END
)) WHERE diff_preview IS NULL AND diff IS NOT NULL;

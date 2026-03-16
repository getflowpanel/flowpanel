CREATE TABLE IF NOT EXISTS flowpanel_meta (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

INSERT INTO flowpanel_meta (key, value)
VALUES
  ('schema_version', '"1.0.0"'),
  ('created_at',     to_jsonb(now()::text))
ON CONFLICT (key) DO NOTHING;

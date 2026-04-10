CREATE TABLE IF NOT EXISTS flowpanel_events (
  id BIGSERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fp_events_created ON flowpanel_events (created_at);

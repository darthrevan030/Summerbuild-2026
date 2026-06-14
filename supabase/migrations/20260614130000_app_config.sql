-- App-wide config flags (admin-only via service_role)
CREATE TABLE app_config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT 'true'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_config FROM anon, authenticated;

-- Seed price provider flags (all enabled by default)
INSERT INTO app_config (key, value) VALUES
  ('eodhd',     'true'::jsonb),
  ('yahoo',     'true'::jsonb),
  ('coingecko', 'true'::jsonb),
  ('goldapi',   'true'::jsonb),
  ('finnhub',   'true'::jsonb)
ON CONFLICT DO NOTHING;

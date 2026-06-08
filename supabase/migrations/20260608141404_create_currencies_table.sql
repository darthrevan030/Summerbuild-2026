-- Admin-managed list of supported base currencies.
-- active = false hides a currency from the picker without deleting it.
-- display_order controls dropdown ordering.

CREATE TABLE IF NOT EXISTS currencies (
  code          text    PRIMARY KEY,
  label         text    NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0
);

ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read; only admins can write (handled at app layer via service role).
CREATE POLICY "Authenticated users can read currencies"
  ON currencies
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Seed default currencies
INSERT INTO currencies (code, label, display_order) VALUES
  ('SGD', 'Singapore Dollar',  0),
  ('USD', 'US Dollar',         1),
  ('EUR', 'Euro',              2),
  ('GBP', 'British Pound',     3),
  ('AUD', 'Australian Dollar', 4),
  ('JPY', 'Japanese Yen',      5),
  ('INR', 'Indian Rupee',      6),
  ('HKD', 'Hong Kong Dollar',  7)
ON CONFLICT (code) DO NOTHING;

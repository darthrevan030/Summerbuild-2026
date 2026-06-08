-- One row per user. display_name and base_currency are user-configurable.
-- Upserted on first login; user_id matches auth.uid() cast to text.

CREATE TABLE IF NOT EXISTS user_settings (
  user_id        text        PRIMARY KEY,
  display_name   text,
  base_currency  text        NOT NULL DEFAULT 'SGD',
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own settings"
  ON user_settings
  FOR ALL
  USING ((auth.uid())::text = user_id)
  WITH CHECK ((auth.uid())::text = user_id);

-- Admin users (role = 'admin' in user_settings) can read all holdings and settings.
-- Write operations remain scoped to own user_id.

CREATE POLICY "Admins can read all holdings"
  ON holdings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_settings
      WHERE user_id = (auth.uid())::text
        AND role = 'admin'
    )
  );

CREATE POLICY "Admins can read all user settings"
  ON user_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_settings us
      WHERE us.user_id = (auth.uid())::text
        AND us.role = 'admin'
    )
  );

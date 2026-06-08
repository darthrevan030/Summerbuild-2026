-- Role-based access: 'user' (default) or 'admin'.
-- First admin must be bootstrapped manually:
--   UPDATE user_settings SET role = 'admin' WHERE user_id = '<uuid>';

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

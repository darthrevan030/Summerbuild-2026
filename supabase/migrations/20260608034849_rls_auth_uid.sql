-- Enable RLS on holdings; scope all operations to the authenticated user.
-- user_id is stored as text, auth.uid() is uuid — cast required.

ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own holdings"
  ON holdings
  FOR ALL
  USING ((auth.uid())::text = user_id)
  WITH CHECK ((auth.uid())::text = user_id);

-- Security hardening + drift reconciliation.
-- The live database diverged from migration history (RLS policies were renamed
-- and is_admin() was introduced ad-hoc, outside any migration). This migration
-- converges both paths — a fresh replay of the earlier migrations AND the live
-- drifted schema — to one canonical state, then closes the remaining holes:
--   1. Column-level privileges: authenticated can no longer write user_settings.role
--   2. Canonical is_admin() SECURITY DEFINER (breaks RLS policy self-reference, 42P17)
--   3. Canonical RLS policy set on user_settings / holdings / currencies / exchanges
--   4. Trigger preventing demotion of the last admin (closes TOCTOU race)

-- ── 1. Column-level write privileges on user_settings ────────────────────────
-- Supabase's default privileges grant table-level ALL to anon/authenticated.
-- A column-level REVOKE is a no-op while the table-level grant exists, so the
-- table-level INSERT/UPDATE must be revoked and only safe columns re-granted.
-- service_role keeps its own full grant and is unaffected.
REVOKE INSERT, UPDATE ON public.user_settings FROM anon, authenticated;

-- user_id must stay in the UPDATE grant: PostgREST upserts
-- (INSERT ... ON CONFLICT DO UPDATE SET <posted cols>) update every posted
-- column including the PK. RLS WITH CHECK still pins it to auth.uid().
GRANT INSERT (user_id, display_name, base_currency, created_at, updated_at)
  ON public.user_settings TO authenticated;
GRANT UPDATE (user_id, display_name, base_currency, updated_at)
  ON public.user_settings TO authenticated;

-- ── 2. is_admin(): SECURITY DEFINER breaks policy self-reference ─────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_settings
    WHERE user_id = (SELECT auth.uid())::text
      AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- ── 3. Canonical RLS policies ─────────────────────────────────────────────────
-- Drop every known historical name (original migrations + live drift), then
-- recreate the canonical set.

-- user_settings
DROP POLICY IF EXISTS "Users can manage own settings"     ON public.user_settings;
DROP POLICY IF EXISTS "Admins can read all user settings" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_self"                ON public.user_settings;
DROP POLICY IF EXISTS "admins select all settings"        ON public.user_settings;
DROP POLICY IF EXISTS "admins update any settings"        ON public.user_settings;

CREATE POLICY "user_settings_self"
  ON public.user_settings
  FOR ALL
  USING ((auth.uid())::text = user_id)
  WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "admins select all settings"
  ON public.user_settings
  FOR SELECT
  USING ((auth.uid())::text = user_id OR public.is_admin());

CREATE POLICY "admins update any settings"
  ON public.user_settings
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- holdings
DROP POLICY IF EXISTS "Users can manage own holdings" ON public.holdings;
DROP POLICY IF EXISTS "Admins can read all holdings"  ON public.holdings;
DROP POLICY IF EXISTS "users_select_own"              ON public.holdings;
DROP POLICY IF EXISTS "users_insert_own"              ON public.holdings;
DROP POLICY IF EXISTS "users_update_own"              ON public.holdings;
DROP POLICY IF EXISTS "users_delete_own"              ON public.holdings;
DROP POLICY IF EXISTS "admins select all holdings"    ON public.holdings;

CREATE POLICY "users_select_own"
  ON public.holdings FOR SELECT
  USING ((auth.uid())::text = user_id);

CREATE POLICY "users_insert_own"
  ON public.holdings FOR INSERT
  WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "users_update_own"
  ON public.holdings FOR UPDATE
  USING ((auth.uid())::text = user_id)
  WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "users_delete_own"
  ON public.holdings FOR DELETE
  USING ((auth.uid())::text = user_id);

CREATE POLICY "admins select all holdings"
  ON public.holdings FOR SELECT
  USING ((auth.uid())::text = user_id OR public.is_admin());

-- currencies (writes normally go through the service role; the admin UPDATE
-- policy additionally permits direct admin updates)
DROP POLICY IF EXISTS "Authenticated users can read currencies" ON public.currencies;
DROP POLICY IF EXISTS "anyone reads currencies"                 ON public.currencies;
DROP POLICY IF EXISTS "admins update currencies"                ON public.currencies;

CREATE POLICY "anyone reads currencies"
  ON public.currencies FOR SELECT
  USING (true);

CREATE POLICY "admins update currencies"
  ON public.currencies FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- exchanges: replace the per-row user_settings subquery with is_admin()
DROP POLICY IF EXISTS "admin_write" ON public.exchanges;
CREATE POLICY "admin_write"
  ON public.exchanges
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 4. Last-admin demotion guard (race-proof backstop for the app check) ─────
-- SECURITY DEFINER so the admin count sees all rows regardless of caller RLS.
-- The advisory xact lock serialises concurrent demotions.
CREATE OR REPLACE FUNCTION public.prevent_last_admin_demotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.role = 'admin' AND NEW.role IS DISTINCT FROM 'admin' THEN
    PERFORM pg_advisory_xact_lock(hashtext('user_settings_last_admin'));
    IF (SELECT count(*) FROM public.user_settings WHERE role = 'admin') <= 1 THEN
      RAISE EXCEPTION 'cannot demote the last admin'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_admin_demotion ON public.user_settings;
CREATE TRIGGER trg_prevent_last_admin_demotion
  BEFORE UPDATE OF role ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_last_admin_demotion();

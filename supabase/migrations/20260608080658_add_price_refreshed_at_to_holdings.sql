-- Tracks when prices were last refreshed so the refresh endpoint can skip
-- holdings that were updated recently (1-hour staleness window).

ALTER TABLE holdings
  ADD COLUMN IF NOT EXISTS price_refreshed_at timestamptz;

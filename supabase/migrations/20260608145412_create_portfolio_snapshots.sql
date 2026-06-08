-- Daily portfolio snapshots, written on each price refresh.
-- Drives the Portfolio Value Over Time and FX Impact charts with real data
-- instead of simulated/interpolated values.
--
-- UNIQUE(user_id, recorded_date) ensures one row per day per user;
-- upsert on refresh replaces the day's value with the latest prices.
--
-- fx_by_currency is a JSONB map of lowercase currency code → SGD impact,
-- e.g. {"usd": 1234, "eur": -56}

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         text        NOT NULL,
  recorded_date   date        NOT NULL DEFAULT CURRENT_DATE,
  value_sgd       numeric     NOT NULL DEFAULT 0,
  cost_sgd        numeric     NOT NULL DEFAULT 0,
  fx_impact_sgd   numeric     NOT NULL DEFAULT 0,
  fx_by_currency  jsonb                DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(user_id, recorded_date)
);

ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own snapshots"
  ON portfolio_snapshots
  FOR ALL
  USING ((auth.uid())::text = user_id)
  WITH CHECK ((auth.uid())::text = user_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_date
  ON portfolio_snapshots (user_id, recorded_date);

import {
  fetchHoldings,
  upsertTickerQuote,
  updateFxRate,
  recordSnapshot,
  correctInstrumentCurrency,
  correctInstrumentAssetType,
} from "@/lib/supabase/data";
import {
  fetchLivePrices,
  fetchLiveFxRates,
  fetchCryptoSparks,
  fetchEquitySparks,
  fetchTickerMeta,
  type TickerMeta,
} from "@/lib/prices";
import { requireAuth } from "@/lib/supabase/guards";
import { enforceRateLimit } from "@/lib/supabase/rate-limit";
import { getProviderFlags } from "@/lib/supabase/app-config";
import { CCY_FLAG, SUPPORTED_CURRENCIES } from "@/lib/formatters";

const STALE_MS = 5 * 60 * 1000; // 5 minutes

function isStale(priceRefreshedAt: string | null): boolean {
  if (!priceRefreshedAt) return true;
  return Date.now() - new Date(priceRefreshedAt).getTime() > STALE_MS;
}

export async function POST() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const limited = await enforceRateLimit("refresh", 12, 60);
  if (limited) return limited;

  const holdings = await fetchHoldings(user.id);

  // Dedupe to one entry per symbol — quotes are now shared across lots/users,
  // so a symbol is refreshed once regardless of how many lots reference it.
  const bySymbol = new Map<string, (typeof holdings)[number]>();
  for (const h of holdings) {
    if (h.ticker !== "—" && !bySymbol.has(h.ticker)) bySymbol.set(h.ticker, h);
  }
  const symbols = [...bySymbol.values()];
  const staleSymbols = symbols.filter((h) => isStale(h.priceRefreshedAt));

  if (staleSymbols.length === 0) {
    // Prices still fresh — but always snapshot so the charts have today's data point
    await recordSnapshot(user.id, holdings);
    return Response.json({ refreshed: 0, skipped: symbols.length });
  }

  const tickers = staleSymbols.map((h) => h.ticker);
  const tickerCurrency = Object.fromEntries(
    staleSymbols.map((h) => [h.ticker, h.currency]),
  );
  // Currencies whose FX rate we should refresh (non-SGD, across all holdings)
  const currencies = [
    ...new Set(holdings.map((h) => h.currency).filter((c) => c !== "SGD")),
  ];

  const providers = await getProviderFlags();

  const [livePrices, liveFxRates, cryptoSparks, equitySparks, liveMeta] =
    await Promise.all([
      fetchLivePrices(tickers, tickerCurrency, providers),
      providers.frankfurter
        ? fetchLiveFxRates()
        : Promise.resolve({} as Record<string, number>),
      providers.coingecko
        ? fetchCryptoSparks(tickers)
        : Promise.resolve({} as Record<string, number[]>),
      providers.finnhub
        ? fetchEquitySparks(tickers, tickerCurrency)
        : Promise.resolve({} as Record<string, number[]>),
      providers.yahoo
        ? fetchTickerMeta(tickers, tickerCurrency)
        : Promise.resolve({} as Record<string, TickerMeta>),
    ]);

  // Auto-heal currencies guessed from the exchange. We only correct when the
  // provider reports a clean, supported currency that differs from what's
  // stored — pence-quoted "GBp" lines and unknown codes are left untouched so a
  // price-in-pence is never mislabelled as pounds. Corrected target currencies
  // are folded into the FX refresh set below so their rate is up to date too.
  const corrected = new Set<string>();
  await Promise.all(
    staleSymbols.map((h) => {
      const detected = liveMeta[h.ticker]?.currency;
      if (
        !detected ||
        detected === h.currency ||
        !SUPPORTED_CURRENCIES.includes(
          detected as (typeof SUPPORTED_CURRENCIES)[number],
        )
      )
        return Promise.resolve();
      corrected.add(detected);
      return correctInstrumentCurrency(
        h.ticker,
        h.currency,
        detected,
        CCY_FLAG[detected] ?? "🌐",
      );
    }),
  );
  for (const c of corrected) if (c !== "SGD" && !currencies.includes(c)) currencies.push(c);

  // Auto-heal asset types mis-stored at import time — e.g. an ETF defaulted to
  // "Equity" by the DBS Vickers parser or a manual add. fetchTickerMeta only
  // reports the unambiguous "ETF" signal (never "Equity"), so this can only
  // upgrade a mislabelled ETF and can't clobber a correctly-set REIT/Gold/Bond.
  await Promise.all(
    staleSymbols.map((h) => {
      const detected = liveMeta[h.ticker]?.assetType;
      if (!detected || detected === h.assetType) return Promise.resolve();
      return correctInstrumentAssetType(h.ticker, h.assetType, detected);
    }),
  );

  // 1. Update the shared price cache — one write per symbol
  await Promise.all(
    staleSymbols.map((h) => {
      const priceResult = livePrices[h.ticker];
      const newPrice = priceResult?.price;
      const sparkData = cryptoSparks[h.ticker] ?? equitySparks[h.ticker];
      return upsertTickerQuote(h.ticker, {
        currentPrice: newPrice && newPrice > 0 ? newPrice : h.currentPrice,
        prevPrice: priceResult?.prevPrice,
        prevPriceSource: priceResult?.prevPriceSource,
        sparkData,
      });
    }),
  );

  // 2. Update FX rates — one write per non-SGD currency
  await Promise.all(
    currencies.map((ccy) => {
      const rate = liveFxRates[ccy];
      return rate && rate > 0 ? updateFxRate(ccy, rate) : Promise.resolve();
    }),
  );

  // Re-fetch after updates to get fresh derived values, then snapshot
  const fresh = await fetchHoldings(user.id);
  await recordSnapshot(user.id, fresh);

  return Response.json({
    refreshed: staleSymbols.length,
    skipped: symbols.length - staleSymbols.length,
  });
}

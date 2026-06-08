import { fetchHoldings, updateHoldingPrice } from "@/lib/supabase/data";
import { fetchLivePrices, fetchLiveFxRates } from "@/lib/prices";
import { createClient } from "@/lib/supabase/server";

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

function isStale(priceRefreshedAt: string | null): boolean {
  if (!priceRefreshedAt) return true;
  return Date.now() - new Date(priceRefreshedAt).getTime() > ONE_HOUR_MS;
}

export async function POST() {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const holdings = await fetchHoldings(user.id);
  const stale = holdings.filter((h) => isStale(h.priceRefreshedAt));

  if (stale.length === 0) {
    return Response.json({ refreshed: 0, skipped: holdings.length });
  }

  // Unique non-placeholder tickers across all stale holdings
  const tickers = [...new Set(stale.map((h) => h.ticker).filter((t) => t !== "—"))];

  const [livePrices, liveFxRates] = await Promise.all([
    fetchLivePrices(tickers),
    fetchLiveFxRates(),
  ]);

  // Always write back (resets price_refreshed_at), using live price where available
  // and falling back to the stored value so we don't zero-out holdings with missing API keys
  await Promise.all(
    stale.map((h) => {
      const newPrice = livePrices[h.ticker];
      const newFx    = h.currency === "SGD" ? 1 : liveFxRates[h.currency];
      return updateHoldingPrice(
        h.id,
        newPrice && newPrice > 0 ? newPrice : h.currentPrice,
        newFx    && newFx    > 0 ? newFx    : h.currentFxRate,
        user.id,
      );
    })
  );

  return Response.json({ refreshed: stale.length, skipped: holdings.length - stale.length });
}

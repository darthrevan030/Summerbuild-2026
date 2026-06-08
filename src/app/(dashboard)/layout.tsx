import { fetchHoldings, fetchUserSettings } from "@/lib/supabase/data";
import {
  computeHeroStats,
  computeAllocationByAsset,
  computeAllocationByGeo,
  computeMovers,
  computeCurrencyCards,
  computeWaterfall,
  generatePortfolioSeries,
  generateFxSeries,
  buildFxColors,
  buildBaseFxRates,
} from "@/lib/portfolio";
import { DashboardShell } from "@/components/DashboardShell";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [holdings, userSettings] = await Promise.all([
    fetchHoldings(user?.id),
    user ? fetchUserSettings(user.id) : Promise.resolve({ displayName: "", baseCurrency: "SGD" }),
  ]);

  const hero = computeHeroStats(holdings);
  const assetAllocation = computeAllocationByAsset(holdings);
  const geoAllocation = computeAllocationByGeo(holdings);
  const movers = computeMovers(holdings);
  const currencyCards = computeCurrencyCards(holdings);
  const waterfallData = computeWaterfall(currencyCards);
  const portfolioSeries = generatePortfolioSeries(hero.total);
  const { series: fxSeries, fxLabels } = generateFxSeries(currencyCards);
  const fxColors = buildFxColors(currencyCards);
  const baseFxRates = buildBaseFxRates(currencyCards);

  return (
    <DashboardShell
      holdings={holdings}
      hero={hero}
      assetAllocation={assetAllocation}
      geoAllocation={geoAllocation}
      movers={movers}
      currencyCards={currencyCards}
      waterfallData={waterfallData}
      portfolioSeries={portfolioSeries}
      fxSeries={fxSeries}
      fxLabels={fxLabels}
      fxColors={fxColors}
      baseFxRates={baseFxRates}
      initialDisplayName={userSettings.displayName}
      initialBaseCurrency={userSettings.baseCurrency}
    >
      {children}
    </DashboardShell>
  );
}

import type { HoldingRow } from "@/types/holding";
import type {
  HeroStats,
  MoverItem,
  CurrencyCard,
  WaterfallItem,
  AllocationSlice,
  PortfolioSeriesPoint,
  FxSeriesPoint,
} from "@/types/portfolio";
import {
  computeCurrentValueSGD,
  computeCostBasisSGD,
  computeAssetGainSGD,
  computeFxGainSGD,
} from "./fx";

const PAL = ["#b79cff", "#5fd0c6", "#6fb0ff", "#f4a6cf", "#8b8bff", "#f0bd8a"];

const FX_COLOR_PALETTE = ["#6fb0ff", "#46d8a0", "#f0bd8a", "#b79cff", "#f4a6cf", "#8b8bff"];

const FALLBACK_FX_RATES: Record<string, number> = {
  SGD: 1, USD: 1.36, EUR: 1.51, GBP: 1.72,
  AUD: 0.88, JPY: 0.0091, INR: 0.016, HKD: 0.174,
};

export function buildFxColors(cards: CurrencyCard[]): Record<string, string> {
  const result: Record<string, string> = {};
  cards.forEach((c, i) => {
    result[c.code.toLowerCase()] = FX_COLOR_PALETTE[i % FX_COLOR_PALETTE.length];
  });
  return result;
}

/** Returns SGD-per-unit rates. Portfolio rates take priority; static fallbacks fill the gaps. */
export function buildBaseFxRates(cards: CurrencyCard[]): Record<string, number> {
  const rates: Record<string, number> = { ...FALLBACK_FX_RATES };
  for (const c of cards) {
    if (c.cur > 0) rates[c.code] = c.cur;
  }
  return rates;
}

export function computeHeroStats(holdings: HoldingRow[]): HeroStats {
  const total = holdings.reduce((s, h) => s + h.valueSGD, 0);
  const cost = holdings.reduce((s, h) => s + h.costSGD, 0);
  const totalGain = total - cost;
  const totalGainPct = cost > 0 ? (totalGain / cost) * 100 : 0;
  const fxImpact = holdings.reduce((s, h) => s + h.fxGain, 0);
  const fxPct = cost > 0 ? (fxImpact / cost) * 100 : 0;
  const neutral = total - fxImpact;

  return {
    total,
    dayChange: 0,
    dayPct: 0,
    totalGain,
    totalGainPct,
    fxImpact,
    fxPct,
    neutral,
    updated: new Date().toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" }) + " SGT",
  };
}

export function computeAllocationByAsset(holdings: HoldingRow[]): AllocationSlice[] {
  const totals: Record<string, number> = {};
  const grandTotal = holdings.reduce((s, h) => s + h.valueSGD, 0);
  for (const h of holdings) {
    totals[h.assetType] = (totals[h.assetType] ?? 0) + h.valueSGD;
  }
  return Object.entries(totals).map(([label, value], i) => ({
    label,
    value: Math.round((value / grandTotal) * 100),
    color: PAL[i % PAL.length],
  }));
}

export function computeAllocationByGeo(holdings: HoldingRow[]): AllocationSlice[] {
  const geoMap: Record<string, string> = {
    USD: "United States",
    SGD: "Singapore",
    EUR: "Europe",
    AUD: "Australia",
    GBP: "United Kingdom",
    INR: "India",
  };
  const totals: Record<string, number> = {};
  const grandTotal = holdings.reduce((s, h) => s + h.valueSGD, 0);
  for (const h of holdings) {
    const geo = geoMap[h.currency] ?? "Global";
    totals[geo] = (totals[geo] ?? 0) + h.valueSGD;
  }
  return Object.entries(totals).map(([label, value], i) => ({
    label,
    value: Math.round((value / grandTotal) * 100),
    color: PAL[i % PAL.length],
  }));
}

export function computeMovers(holdings: HoldingRow[]): {
  gainers: MoverItem[];
  losers: MoverItem[];
} {
  const items: MoverItem[] = holdings.map((h) => {
    const cost = computeCostBasisSGD(h);
    const asset = cost > 0 ? (computeAssetGainSGD(h) / cost) * 100 : 0;
    const fx = cost > 0 ? (computeFxGainSGD(h) / cost) * 100 : 0;
    return { name: h.name, ticker: h.ticker, asset, fx };
  });
  const sorted = [...items].sort((a, b) => (b.asset + b.fx) - (a.asset + a.fx));
  return {
    gainers: sorted.filter((m) => m.asset + m.fx >= 0),
    losers: sorted.filter((m) => m.asset + m.fx < 0).reverse(),
  };
}

export function computeCurrencyCards(holdings: HoldingRow[]): CurrencyCard[] {
  const groups: Record<string, HoldingRow[]> = {};
  for (const h of holdings) {
    if (h.currency === "SGD") continue;
    (groups[h.currency] ??= []).push(h);
  }
  const flags: Record<string, string> = {
    USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", AUD: "🇦🇺", INR: "🇮🇳", JPY: "🇯🇵", HKD: "🇭🇰",
  };
  const grandTotal = holdings.reduce((s, h) => s + h.valueSGD, 0);

  return Object.entries(groups).map(([code, hs]) => {
    const exposure = hs.reduce((s, h) => s + h.valueSGD, 0);
    const avgFx = hs.reduce((s, h) => s + h.buyFxRate * h.valueSGD, 0) / exposure;
    const curFx = hs[0]?.currentFxRate ?? 1;
    const deltaPct = avgFx > 0 ? ((curFx - avgFx) / avgFx) * 100 : 0;
    const impact = hs.reduce((s, h) => s + computeFxGainSGD(h), 0);
    return {
      code,
      flag: flags[code] ?? "🏳️",
      exposure,
      exposurePct: grandTotal > 0 ? (exposure / grandTotal) * 100 : 0,
      avg: avgFx,
      cur: curFx,
      deltaPct,
      impact,
      dir: deltaPct >= 0 ? "pos" : "neg",
      spark: hs[0]?.sparkData ?? [],
    };
  });
}

export function computeWaterfall(cards: CurrencyCard[]): WaterfallItem[] {
  return cards.map((c) => ({
    code: c.code,
    value: Math.round(c.impact),
    dir: c.impact >= 0 ? "pos" : "neg",
  }));
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function generatePortfolioSeries(holdings: HoldingRow[]): PortfolioSeriesPoint[] {
  if (holdings.length === 0) return [];

  const now = new Date();
  const nowYr = now.getFullYear();
  const nowMo = now.getMonth(); // 0-indexed

  const earliest = holdings.reduce((min, h) => (h.buyDate < min ? h.buyDate : min), holdings[0].buyDate);
  const startYr = parseInt(earliest.slice(0, 4));
  const startMo = parseInt(earliest.slice(5, 7)) - 1;
  const totalMonths = (nowYr - startYr) * 12 + (nowMo - startMo) + 1;
  if (totalMonths <= 0) return [];

  const series: PortfolioSeriesPoint[] = [];
  let yr = startYr, mo = startMo;

  for (let i = 0; i < totalMonths; i++) {
    const date = `${yr}-${String(mo + 1).padStart(2, "0")}`;
    const isLast = i === totalMonths - 1;
    let v = 0;

    for (const h of holdings) {
      if (h.buyDate.slice(0, 7) > date) continue; // not yet owned

      if (isLast) {
        v += h.valueSGD;
      } else {
        const buyYr = parseInt(h.buyDate.slice(0, 4));
        const buyMo = parseInt(h.buyDate.slice(5, 7)) - 1;
        const buyIdx = (buyYr - startYr) * 12 + (buyMo - startMo);
        const totalAge = totalMonths - 1 - buyIdx;
        const t = totalAge > 0 ? (i - buyIdx) / totalAge : 1;
        const trend = h.costSGD + (h.valueSGD - h.costSGD) * t;
        // Deterministic noise per holding+month so chart is stable across re-renders
        const seed = h.ticker.charCodeAt(0) * 17 + i;
        const amp = Math.abs(h.valueSGD) * 0.018;
        v += trend + Math.sin(seed * 0.7) * amp * 0.7 + Math.sin(seed * 1.9 + 1) * amp * 0.3;
      }
    }

    series.push({ label: `${MON[mo]} ${String(yr).slice(2)}`, date, v: Math.max(0, Math.round(v)) });
    mo++;
    if (mo > 11) { mo = 0; yr++; }
  }

  // Pin last point to exact current total
  const total = holdings.reduce((s, h) => s + h.valueSGD, 0);
  if (series.length > 0) series[series.length - 1].v = Math.round(total);

  return series;
}

/** Generates simulated FX impact series. Returns series data + YYYY-MM date strings. */
export function generateFxSeries(currencyCards: CurrencyCard[], holdings: HoldingRow[]): {
  series: FxSeriesPoint[];
  fxLabels: string[];
} {
  const finals: Record<string, number> = {};
  for (const c of currencyCards) {
    finals[c.code.toLowerCase()] = Math.round(c.impact);
  }
  const keys = Object.keys(finals);
  if (keys.length === 0) return { series: [], fxLabels: [] };

  const now = new Date();
  const nowYr = now.getFullYear();
  const nowMo = now.getMonth();

  const fxHoldings = holdings.filter((h) => h.currency !== "SGD");
  const earliest = fxHoldings.length > 0
    ? fxHoldings.reduce((min, h) => (h.buyDate < min ? h.buyDate : min), fxHoldings[0].buyDate)
    : `${nowYr - 1}-01`;
  const startYr = parseInt(earliest.slice(0, 4));
  const startMo = parseInt(earliest.slice(5, 7)) - 1;
  const totalMonths = Math.max((nowYr - startYr) * 12 + (nowMo - startMo) + 1, 2);

  const series: FxSeriesPoint[] = [];
  const fxLabels: string[] = [];
  let yr = startYr, mo = startMo;

  for (let i = 0; i < totalMonths; i++) {
    fxLabels.push(`${yr}-${String(mo + 1).padStart(2, "0")}`);
    const t = totalMonths > 1 ? i / (totalMonths - 1) : 1;
    const ease = t * t * (3 - 2 * t);
    const wobFor = (val: number, seed: number) =>
      Math.sin(i * 0.6 + seed) * (Math.abs(val) * 0.07);

    const point: FxSeriesPoint = { i };
    keys.forEach((k, idx) => {
      point[k] = Math.round(finals[k] * ease + wobFor(finals[k], idx));
    });
    series.push(point);
    mo++;
    if (mo > 11) { mo = 0; yr++; }
  }

  const last = series[series.length - 1];
  if (last) for (const k of keys) last[k] = finals[k];

  return { series, fxLabels };
}

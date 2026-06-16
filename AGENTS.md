<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Codebase Guide

> A finance/portfolio dashboard. Track your holdings (stocks, ETFs, REITs, bonds, T-bills, gold, real estate), CPF/SRS/cash balances, FX exposure, dividends, and AI-generated analysis. Built for a Singapore (SGD-base) investor.
>
> **Last reviewed:** 2026-06-16. Keep this section current when you make structural changes.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16.2.7 (App Router, React 19) — see breaking-changes note above |
| Language | TypeScript 5 (strict) |
| Database / Auth | Supabase (Postgres + Row Level Security + Google OAuth) |
| Styling | Tailwind CSS v4 (via `@tailwindcss/postcss`), CSS variables for theming |
| Animation | `motion` (Framer Motion) — landing page only |
| AI | `@anthropic-ai/sdk` — streaming analysis/Q&A (use latest Claude models) |
| Prices/FX | `yahoo-finance2`, Frankfurter (FX), EODHD, Finnhub |
| Notifications | `sonner` (toasts) |
| Hosting | Vercel (`@vercel/analytics`, `@vercel/speed-insights`) |

**Scripts:** `npm run dev` · `npm run build` · `npm run lint` (eslint). No test runner is configured. Type-check with `npx tsc --noEmit`.

## The big picture: how data flows

The app is **server-rendered with a single heavy data fetch at the dashboard layout**, then handed to a client context. Understand this and everything else falls into place:

```
src/app/(dashboard)/layout.tsx   ← SERVER component, force-dynamic
  ├─ fetchHoldings / fetchUserSettings / fetchSnapshots   (Supabase, parallel)
  ├─ compute* / generate* functions from lib/portfolio.ts (all derived data)
  └─ <DashboardShell ...props>                            (passes everything down)
        └─ PortfolioProvider (src/context/portfolio.tsx)  ← CLIENT context
              └─ every dashboard page calls usePortfolio()
```

- **Pages do NOT fetch their core data.** They read it from `usePortfolio()`. The layout already computed holdings, hero stats, allocations, movers, currency cards, waterfall, portfolio time-series, and FX series.
- **Currency conversion is centralised in the context.** All money values are stored in **SGD**. `usePortfolio()` exposes `toBase()`, `fmtVal()`, `fmtSigned()` which convert SGD → the user's chosen base currency for display. Never format currency by hand in a page — use these.
- **Mutations** (add/edit/sell/delete, refresh prices, settings) go through `src/app/api/**` routes, then call `router.refresh()` to re-run the server layout and pull fresh data.

## Directory map

```
src/
├─ app/
│  ├─ (auth)/              Login page + OAuth callback route
│  ├─ (dashboard)/         All authed pages; layout.tsx does the master fetch
│  │   ├─ overview/ holdings/ add/ analysis/ charts/ fx-lab/ settings/ admin/
│  │   └─ layout.tsx       ★ entry point for dashboard data flow
│  ├─ api/                 Route handlers (see API surface below)
│  ├─ layout.tsx           Root layout (theme, fonts, analytics)
│  └─ page.tsx             Public landing page
├─ components/
│  ├─ (top level)          DashboardShell, NerveBar, TabBar, SummaryRail, Select, Icon, etc.
│  ├─ charts/              AreaTrend, Donut, Dumbbell, FXArea, Legend, Spark
│  └─ landing/             Marketing/landing animations (motion-heavy)
├─ context/portfolio.tsx   ★ client-side portfolio state + currency conversion
├─ hooks/                  useCachedList, useCurrencies, useExchanges, useFxSparks, useOptimisticToggle
├─ lib/
│  ├─ supabase/            DB layer: client/server/admin, data.ts (all queries), guards, rate-limit, app-config
│  ├─ providers/           External data: fx, sgx, dividends, history
│  ├─ api/client/          analyst-api.ts (streamSentiment/streamAsk)
│  ├─ api/server/          list-route.ts (createTableListGET factory)
│  ├─ portfolio.ts         ★ all compute*/generate* derived-data functions
│  ├─ prices.ts            Live price fetching + symbol mapping per provider
│  ├─ group-holdings.ts    Aggregate lots → positions (toNetPositions, groupHoldings)
│  ├─ formatters.ts        NF, pct, rate, ccyFmt, ccySigned, CCY_SYMBOL, SUPPORTED_CURRENCIES
│  └─ fx.ts, positions.ts, hexA.ts, useCountUp.ts, useDateRange.ts
├─ types/                  holding, portfolio, settings, snapshot, chat
└─ proxy.ts                Edge middleware: CSP (nonce), Supabase session refresh
supabase/migrations/       Schema history (see Data model)
design/                    ⚠️ Old .jsx mockups — NOT used by the app (prototype leftovers)
```

## Data model (core domain types)

Defined in `src/types/holding.ts`. The DB schema was **normalized** (migration `20260615100000`) into **instruments** (one per security), **lots** (individual buy transactions), and **overrides** (per-user manual fields). The app re-assembles these into:

- **`Holding`** — one lot, fully denormalized (ticker, units, prices, FX rates, asset type, source, dividend/bond fields…).
- **`HoldingRow`** — a `Holding` plus computed SGD figures (`costSGD`, `valueSGD`, `assetGain`, `fxGain`, `totalPct`) and a `detail` block. **This is the main currency you pass around the UI.**
- **`GroupedHolding`** — multiple lots of the same ticker aggregated into one row (for the grouped holdings view).
- Asset types: `Equity | ETF | REIT | Gold | RE | Bond | T-Bill`. `FIXED_INCOME_TYPES` = {Bond, T-Bill}. Fund sources: `CPF | SRS | Cash`.

## API surface (`src/app/api/`)

User-scoped (require auth): `holdings` (+ `/refresh` `/backfill` `/dividends` `/ratios`), `cash`, `cpf`, `settings`, `prices`, `quotes`, `fx` (+ `/candles`), `portfolio/analytics`, `portfolio/fx-series`, `news`, `analyst` (Anthropic streaming).
Reference lists: `currencies`, `exchanges` (built on the `createTableListGET` factory).
Admin-only (require admin role): `admin/users/[id]`, `admin/currencies/[code]`, `admin/exchanges/[code]`, `admin/config/[key]`.

**Server-side guard helpers** live in `src/lib/supabase/guards.ts`: `requireAuth()` and `requireAdmin()` return `{ user, error }` — return `error` early if present. Rate limiting via `enforceRateLimit()` (`rate-limit.ts`); provider on/off flags via `getProviderFlags()` (`app-config.ts`).

## Conventions & gotchas

- **All monetary values are in SGD internally.** Convert to display currency only via the `usePortfolio()` helpers.
- **Pages read from context, not fetch.** If you need new derived data on a page, add a `compute*` function in `lib/portfolio.ts`, call it in `(dashboard)/layout.tsx`, thread it through `DashboardShell` → `PortfolioProvider`, then consume via `usePortfolio()`.
- **After a mutation, call `router.refresh()`** to re-run the server layout instead of manually re-fetching.
- **`src/proxy.ts` is the middleware** (CSP nonce + Supabase auth refresh) — not a conventional name; don't delete it expecting a `middleware.ts`.
- **`design/` is dead weight** — mockups, nothing in `src/` imports it.
- **Reference-list pages** (currencies, exchanges) use the `useCachedList` hook + `createTableListGET` server factory. Reuse these rather than hand-rolling fetch+cache.

## Known tech debt (see `report.md` for the full cleanup plan)

- **Dead code:** `lib/seed.ts` (whole file), `groupIntoPositions`/`Position` in `lib/positions.ts`, `streamAnalysis` in `lib/api-client.ts`, `applyAccent` in `lib/hexA.ts`.
- **Giant page components:** `holdings/page.tsx` (~1600 lines), `add/page.tsx` (~1170), `analysis/page.tsx` (~910) — mix data, state, and UI; need component/hook extraction.
- **API boilerplate:** ~15 routes repeat the `requireAuth` guard by hand; validation regexes (`CCY_RE`, `DATE_RE`) and symbol maps (`EODHD_CODE_REMAP`) are duplicated across files.
- **Misplaced hooks:** `useCountUp.ts` / `useDateRange.ts` live in `lib/` but belong in `hooks/`.
- ⚠️ `buildFxColors` / `buildBaseFxRates` in `lib/portfolio.ts` LOOK unused but ARE used in `(dashboard)/layout.tsx` — do not delete.

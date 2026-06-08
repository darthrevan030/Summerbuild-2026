# Finance Dashboard — Summerbuild 2026

A personal portfolio tracker with real-time FX conversion, AI analysis, and a terminal-inspired UI. Built with Next.js 15 (App Router) and Supabase.

## Features

- **Holdings** — CRUD for stocks, ETFs, REITs, crypto, gold, and real estate; live price refresh with 1-hour Supabase cache
- **Overview** — Portfolio value in any base currency, total gain/loss, FX gain/loss, cost vs. value summary rail
- **FX Lab** — Currency impact analysis with date-range charts and a dumbbell gain/loss breakdown
- **Charts** — Asset allocation donut, portfolio trend area chart, spark lines; 1D–All time presets + custom date picker
- **Analysis** — Claude-powered AI analyst for portfolio commentary
- **Add / Import** — Form to add new holdings with full field validation
- **Settings** — Display name, base currency selector (SGD, USD, EUR, GBP, JPY, AUD, HKD, CNY)

## Tech Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, React 19) |
| Auth | Supabase Magic Link (PKCE flow) |
| Database | Supabase Postgres with RLS |
| AI | Anthropic Claude SDK |
| Styling | CSS Modules (terminal palette) |
| Analytics | Vercel Analytics |

## Project Structure

```text
src/
├── app/
│   ├── (auth)/           # Login + PKCE callback
│   ├── (dashboard)/      # Protected tab pages (overview, holdings, fx-lab, charts, analysis, add, settings)
│   └── api/              # Route handlers (holdings CRUD, prices, FX, quotes, analyst, settings)
├── components/
│   ├── charts/           # AreaTrend, Donut, Dumbbell, FXArea, Spark, Legend
│   ├── DashboardShell    # Top-level layout wrapper
│   ├── NerveBar          # Header with base-currency dropdown
│   ├── TabBar            # Navigation tabs with icons
│   ├── TweaksPanel       # Theme colour picker
│   └── Select            # Custom dropdown component
├── context/portfolio.tsx  # Global portfolio state + derived metrics
├── lib/
│   ├── supabase/         # Server/client Supabase helpers + data queries
│   ├── portfolio.ts      # Series generation + FX math
│   ├── prices.ts         # Shared price-fetch logic (Yahoo Finance proxy)
│   ├── formatters.ts     # fmtVal / fmtSigned base-currency formatters
│   └── fx.ts             # FX rate helpers + fallback rates
└── types/                # HoldingRow, PortfolioSnapshot, UserSettings, etc.
```

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project with the schema below

### Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### Database Schema

Run in the Supabase SQL editor:

```sql
create table holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  ticker text not null,
  name text not null,
  asset_type text not null,
  broker text,
  strategy text,
  units numeric not null,
  currency text not null,
  flag text,
  icon text,
  buy_price numeric not null,
  buy_date date not null,
  buy_fx_rate numeric,
  current_price numeric,
  current_fx_rate numeric,
  spark_data numeric[],
  notes text,
  price_refreshed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table holdings enable row level security;
create policy "users see own holdings" on holdings for all using (auth.uid() = user_id);

create table user_settings (
  user_id uuid primary key references auth.users,
  display_name text,
  base_currency text default 'SGD',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table user_settings enable row level security;
create policy "users see own settings" on user_settings for all using (auth.uid() = user_id);
```

### Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to `/login` — enter your email to receive a magic link.

## API Routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/holdings` | GET / POST / PATCH / DELETE | Holdings CRUD |
| `/api/holdings/refresh` | POST | Refresh stale prices (1-hour cache) |
| `/api/prices` | GET | Fetch current price for a ticker |
| `/api/fx` | GET | FX rate lookup |
| `/api/quotes` | GET | Batch quote fetch |
| `/api/analyst` | POST | Claude AI portfolio analysis |
| `/api/settings` | GET / POST | User settings |

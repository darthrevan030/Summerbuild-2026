"use client";

import { useState, useEffect } from "react";
import { SUPPORTED_CURRENCIES } from "@/lib/formatters";
import type { CurrencyRow } from "@/app/api/currencies/route";

// Module-level cache — one fetch per browser session across all components
let CCY_CACHE: string[] | null = null;

export function useCurrencies(): string[] {
  const [currencies, setCurrencies] = useState<string[]>(
    CCY_CACHE ?? [...SUPPORTED_CURRENCIES]
  );

  useEffect(() => {
    if (CCY_CACHE) return;
    fetch("/api/currencies")
      .then((r) => r.json())
      .then((rows: CurrencyRow[]) => {
        const active = rows.filter((c) => c.active).map((c) => c.code);
        if (active.length > 0) {
          CCY_CACHE = active;
          setCurrencies(active);
        }
      })
      .catch(() => {});
  }, []);

  return currencies;
}

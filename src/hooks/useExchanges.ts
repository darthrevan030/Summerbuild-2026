"use client";

import { useState, useEffect } from "react";
import type { ExchangeRow } from "@/app/api/exchanges/route";

const NONE: ExchangeRow = { code: "", label: "— No exchange (physical / unlisted)", region: "", active: true, display_order: 0 };

let CACHE: ExchangeRow[] | null = null;

export function useExchanges(): ExchangeRow[] {
  const [exchanges, setExchanges] = useState<ExchangeRow[]>(CACHE ?? [NONE]);

  useEffect(() => {
    if (CACHE) return;
    fetch("/api/exchanges")
      .then((r) => r.json())
      .then((rows: ExchangeRow[]) => {
        const active = [NONE, ...rows.filter((e) => e.active)];
        CACHE = active;
        setExchanges(active);
      })
      .catch(() => {});
  }, []);

  return exchanges;
}

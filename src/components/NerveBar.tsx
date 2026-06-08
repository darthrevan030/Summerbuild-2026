"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCountUp } from "@/lib/useCountUp";
import { pct, CCY_SYMBOL, SUPPORTED_CURRENCIES } from "@/lib/formatters";
import { usePortfolio } from "@/context/portfolio";
import { createClient } from "@/lib/supabase/client";
import type { HeroStats } from "@/types/portfolio";

interface NerveBarProps {
  hero: HeroStats;
  animate?: boolean;
  onTweaksToggle?: () => void;
}

export function NerveBar({ hero, animate = true, onTweaksToggle }: NerveBarProps) {
  const { displayName, fmtVal, fmtSigned, baseCurrency, setBaseCurrency } = usePortfolio();
  const total = useCountUp(hero.total, 1300, animate);
  const [spin, setSpin] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [ccyOpen, setCcyOpen] = useState(false);
  const [dropPos, setDropPos] = useState<{ top: number; right: number } | null>(null);
  const ccyRef = useRef<HTMLDivElement>(null);
  const ccyBtnRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const dayUp = hero.dayChange >= 0;

  useEffect(() => {
    if (!ccyOpen) return;
    function handleOutside(e: MouseEvent) {
      if (ccyRef.current && !ccyRef.current.contains(e.target as Node)) {
        setCcyOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [ccyOpen]);

  function handleCcyToggle() {
    if (!ccyOpen && ccyBtnRef.current) {
      const r = ccyBtnRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setCcyOpen((v) => !v);
  }

  async function switchCurrency(c: string) {
    setBaseCurrency(c);
    setCcyOpen(false);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseCurrency: c }),
    });
  }

  const wordmark = displayName ? `${displayName}'s Portfolio` : "PORTFOLIO";

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="nerve">
      <div className="wordmark">
        <span className="serif mark">{wordmark}</span>
        <span className="ui mark-sub">PERSONAL WEALTH TERMINAL</span>
      </div>
      <div className="nerve-center">
        <div className="mono hero-total">{fmtVal(total)}</div>
        <div className="hero-day">
          <Icon name={dayUp ? "up" : "down"} size={13} style={{ color: dayUp ? "var(--gain)" : "var(--loss)" }} />
          <span className="mono" style={{ color: dayUp ? "var(--gain)" : "var(--loss)" }}>
            {fmtSigned(hero.dayChange)} ({pct(hero.dayPct)})
          </span>
        </div>
      </div>
      <div className="nerve-right">
        <div className="nr-fx mono">
          FX <span style={{ color: hero.fxImpact >= 0 ? "var(--fx-positive)" : "var(--fx-negative)" }}>
            {fmtSigned(hero.fxImpact)}
          </span>
        </div>
        <div className="ccy-switch" ref={ccyRef}>
          <button
            ref={ccyBtnRef}
            className="nr-ccy mono"
            onClick={handleCcyToggle}
            title="Switch base currency"
            style={{ cursor: "pointer", userSelect: "none" }}
          >
            {CCY_SYMBOL[baseCurrency] ?? baseCurrency} {baseCurrency} ▾
          </button>
          {ccyOpen && dropPos && (
            <div
              className="ccy-drop"
              style={{ position: "fixed", top: dropPos.top, right: dropPos.right }}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <button
                  key={c}
                  className={"ccy-drop-opt" + (c === baseCurrency ? " active" : "")}
                  onClick={() => switchCurrency(c)}
                >
                  <span className="mono">{CCY_SYMBOL[c] ?? c}</span>
                  <span className="ui">{c}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="nr-time mono">{hero.updated}</div>
        <button
          className={"refresh" + (spin ? " spin" : "")}
          onClick={() => { setSpin(true); setTimeout(() => setSpin(false), 800); }}
          title="Refresh"
        >
          <Icon name="refresh" size={16} />
        </button>
        {onTweaksToggle && (
          <button className="refresh" onClick={onTweaksToggle} title="Tweaks">
            <Icon name="sliders" size={15} />
          </button>
        )}
        <button
          className="refresh"
          onClick={handleLogout}
          disabled={loggingOut}
          title="Log out"
          style={{ opacity: loggingOut ? 0.5 : 1 }}
        >
          <Icon name="logout" size={15} />
        </button>
      </div>
    </header>
  );
}

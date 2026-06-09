"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

export type ToastKind = "success" | "error" | "info";

interface ToastItem { id: number; msg: string; kind: ToastKind; }
interface ToastCtx  { toast: (msg: string, kind?: ToastKind) => void; }

const Ctx = createContext<ToastCtx>({ toast: () => {} });

export function useToast() { return useContext(Ctx); }

const ICON: Record<ToastKind, string> = {
  success: "check",
  error:   "x",
  info:    "sparkles",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((msg: string, kind: ToastKind = "success") => {
    const id = ++counter.current;
    setItems((prev) => [...prev, { id, msg, kind }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast-pill toast-${t.kind}`}>
            <Icon name={ICON[t.kind]} size={13} />
            <span className="ui">{t.msg}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

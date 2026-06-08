"use client";

import { useState } from "react";

// months = calendar months to look back; 999 = "All"
export const RANGES: [string, number][] = [
  ["1M", 1], ["3M", 3], ["6M", 6], ["1Y", 12], ["3Y", 36], ["All", 999],
];
export const DEFAULT_N = 12; // 1Y

export interface DateRange {
  startDate: string;
  endDate: string;
  minDate: string;
  maxDate: string;
  activePreset: number;   // index into RANGES, or -1 for custom
  showCustom: boolean;
  selectPreset: (n: number) => void;
  handleStartChange: (v: string) => void;
  handleEndChange: (v: string) => void;
  toggleCustom: () => void;
}

/** Returns the YYYY-MM string that is `months` calendar months before today, clamped to minDate. */
function calendarStart(months: number, minDate: string): string {
  if (months >= 999) return minDate;
  const d = new Date();
  d.setMonth(d.getMonth() - months + 1);
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return ym < minDate ? minDate : ym;
}

export function useDateRange(labels: string[], defaultN = DEFAULT_N): DateRange {
  const minDate = labels[0] ?? new Date().toISOString().slice(0, 7);
  const maxDate = labels[labels.length - 1] ?? new Date().toISOString().slice(0, 7);

  const [startDate, setStartDate] = useState(() => calendarStart(defaultN, minDate));
  const [endDate,   setEndDate]   = useState(maxDate);
  const [showCustom, setShowCustom] = useState(false);

  const activePreset = RANGES.findIndex(
    ([, n]) => startDate === calendarStart(n, minDate) && endDate === maxDate
  );

  function selectPreset(n: number) {
    setStartDate(calendarStart(n, minDate));
    setEndDate(maxDate);
    setShowCustom(false);
  }

  function handleStartChange(v: string) {
    setStartDate(v);
    if (v > endDate) setEndDate(v);
  }

  function handleEndChange(v: string) {
    setEndDate(v);
    if (v < startDate) setStartDate(v);
  }

  return {
    startDate, endDate, minDate, maxDate,
    activePreset, showCustom,
    selectPreset, handleStartChange, handleEndChange,
    toggleCustom: () => setShowCustom((v) => !v),
  };
}

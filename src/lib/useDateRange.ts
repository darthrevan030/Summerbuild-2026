"use client";

import { useState } from "react";

export const RANGES: [string, number][] = [
  ["1D", 1], ["1W", 2], ["1M", 3], ["3M", 4],
  ["6M", 7], ["1Y", 13], ["3Y", 37], ["All", 999],
];
export const DEFAULT_N = 13; // 1Y

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

export function useDateRange(labels: string[], defaultN = DEFAULT_N): DateRange {
  const minDate = labels[0] ?? "2023-01";
  const maxDate = labels[labels.length - 1] ?? "2026-06";

  function presetStart(n: number): string {
    return labels[Math.max(0, labels.length - n)] ?? minDate;
  }

  const [startDate, setStartDate] = useState(() => presetStart(defaultN));
  const [endDate,   setEndDate]   = useState(maxDate);
  const [showCustom, setShowCustom] = useState(false);

  const activePreset = RANGES.findIndex(
    ([, n]) => startDate === presetStart(n) && endDate === maxDate
  );

  function selectPreset(n: number) {
    setStartDate(presetStart(n));
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

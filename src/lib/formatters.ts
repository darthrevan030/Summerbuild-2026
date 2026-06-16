const NF = (n: number, d = 0): string =>
  Math.abs(n).toLocaleString("en-SG", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

const pct = (n: number, d = 2): string => (n < 0 ? "−" : "+") + NF(n, d) + "%";

const rate = (n: number): string => NF(n, 4);

const CCY_SYMBOL: Record<string, string> = {
  SGD: "S$",
  USD: "US$",
  EUR: "€",
  GBP: "£",
  AUD: "A$",
  JPY: "¥",
  INR: "₹",
  HKD: "HK$",
};

function ccyFmt(n: number, ccy: string, d = 0): string {
  const sym = CCY_SYMBOL[ccy] ?? ccy + " ";
  return sym + NF(n, d);
}

function ccySigned(n: number, ccy: string, d = 0): string {
  const sym = CCY_SYMBOL[ccy] ?? ccy + " ";
  return (n < 0 ? "−" : "+") + sym + NF(n, d);
}

const SUPPORTED_CURRENCIES = [
  "SGD",
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "JPY",
  "INR",
  "HKD",
] as const;

const CCY_FLAG: Record<string, string> = {
  SGD: "🇸🇬",
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  AUD: "🇦🇺",
  JPY: "🇯🇵",
  INR: "🇮🇳",
  HKD: "🇭🇰",
};

export {
  NF,
  pct,
  rate,
  ccyFmt,
  ccySigned,
  CCY_SYMBOL,
  CCY_FLAG,
  SUPPORTED_CURRENCIES,
};

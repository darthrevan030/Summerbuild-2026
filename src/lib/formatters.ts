const NF = (n: number, d = 0): string =>
  Math.abs(n).toLocaleString("en-SG", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

const sgd = (n: number, d = 0): string => "S$" + NF(n, d);

// U+2212 minus sign, not ASCII hyphen
const sgdSigned = (n: number, d = 0): string =>
  (n < 0 ? "−" : "+") + "S$" + NF(n, d);

const pct = (n: number, d = 2): string =>
  (n < 0 ? "−" : "+") + NF(n, d) + "%";

const rate = (n: number): string => NF(n, 4);

const CCY_SYMBOL: Record<string, string> = {
  SGD: "S$", USD: "US$", EUR: "€", GBP: "£",
  AUD: "A$", JPY: "¥", INR: "₹", HKD: "HK$",
};

function ccyFmt(n: number, ccy: string, d = 0): string {
  const sym = CCY_SYMBOL[ccy] ?? ccy + " ";
  return sym + NF(n, d);
}

function ccySigned(n: number, ccy: string, d = 0): string {
  const sym = CCY_SYMBOL[ccy] ?? ccy + " ";
  return (n < 0 ? "−" : "+") + sym + NF(n, d);
}

const SUPPORTED_CURRENCIES = ["SGD", "USD", "EUR", "GBP", "AUD", "JPY", "INR", "HKD"] as const;
export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

export { NF, sgd, sgdSigned, pct, rate, ccyFmt, ccySigned, CCY_SYMBOL, SUPPORTED_CURRENCIES };

import type { ParsedTrade, ParseResult } from "./types";

const MONTHS: Record<string, string> = {
  January: "01", February: "02", March: "03", April: "04",
  May: "05", June: "06", July: "07", August: "08",
  September: "09", October: "10", November: "11", December: "12",
  Jan: "01", Feb: "02", Mar: "03", Apr: "04",
  Jun: "06", Jul: "07", Aug: "08", Sep: "09",
  Oct: "10", Nov: "11", Dec: "12",
};

// "09 Jun 2026" or "25-May-2026"
function parseDate(s: string): string {
  const m1 = s.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (m1) {
    const mon = MONTHS[m1[2]] ?? MONTHS[m1[2].substring(0, 3)] ?? "01";
    return `${m1[3]}-${mon}-${m1[1].padStart(2, "0")}`;
  }
  const m2 = s.match(/(\d{1,2})-(\w+)-(\d{4})/);
  if (m2) {
    const mon = MONTHS[m2[2]] ?? MONTHS[m2[2].substring(0, 3)] ?? "01";
    return `${m2[3]}-${mon}-${m2[1].padStart(2, "0")}`;
  }
  return "";
}

// Map PDF exchange labels → app exchange codes
const EXCHANGE_MAP: Record<string, string> = {
  LSE: "LSE",
  SGX: "SI",
  NYSE: "US",
  NASDAQ: "US",
  HKEX: "HK",
  HK: "HK",
  ASX: "AU",
  TSE: "TSE",
  XETRA: "XETRA",
  BURSA: "",
};

const EXCHANGE_PATTERN = /\b(LSE|SGX|NYSE|NASDAQ|HKEX|ASX|TSE|XETRA|HK|BURSA)\b/;

function normalizeAssetType(raw: string): string {
  const t = raw.toUpperCase().trim();
  if (t === "ETF") return "ETF";
  if (t.includes("REIT")) return "REIT";
  if (t.includes("BOND")) return "Bond";
  if (t.includes("T-BILL") || t.includes("TBILL")) return "T-Bill";
  return "Equity";
}

// Parentheticals that are NOT tickers (exchange codes, currencies, legal refs)
const NON_TICKER_PARENS = new Set([
  "SGX","LSE","NYSE","NASDAQ","HKEX","ASX","TSE","XETRA","HK","BURSA",
  "SGD","USD","EUR","GBP","HKD","AUD","JPY","INR",
  "RSP","CPF","SRS","GST","CDP","MAS",
]);

// ── ETF / Stock Confirmation Note ────────────────────────────────────────────
// pdf-parse v1 (pdfjs-dist v2) extracts columns right-to-left on some pages,
// so the fine-print disclaimer may appear BEFORE the contract table in the
// linearised text. We therefore anchor on the (TICKER) parenthetical and the
// contract number independently rather than relying on positional order.

function parseEtfConfirmationNote(text: string): ParseResult {
  const warnings: string[] = [];

  // ── Contract number (BSTK…, SSTK…, BSHARE…, etc.) ───────────────────────
  if (!/\b[A-Z]{3,}\d{10,}\b/.test(text)) {
    warnings.push("No contract number found in confirmation note.");
    return { broker: "FSMOne", docType: "etf-confirmation", trades: [], warnings };
  }

  // ── Date: any "DD MMM YYYY" in the whole document ────────────────────────
  const dateMatch = text.match(/(\d{2}\s+\w{3,9}\s+\d{4})/);
  const buyDate = dateMatch ? parseDate(dateMatch[1]) : "";
  if (!buyDate) warnings.push("Could not parse transaction date.");

  // ── Ticker: find (SYMBOL) in whole text, skip known non-tickers ──────────
  // Use ALL matches and take the last valid one; disclaimers tend to have
  // "(SGX)" or "(the Company)" which are filtered below.
  const allParens = [...text.matchAll(/\(([A-Z0-9]{2,8})\)/g)];
  const tickerCandidates = allParens.filter((m) => !NON_TICKER_PARENS.has(m[1]));
  const ticker = tickerCandidates.length > 0
    ? tickerCandidates[tickerCandidates.length - 1][1]
    : "";

  // ── Security name + exchange ──────────────────────────────────────────────
  let name = ticker || "Unknown";
  let exchange = "";

  if (ticker) {
    const tickerTag = `(${ticker})`;
    const tickerPos = text.lastIndexOf(tickerTag);
    const before = text.substring(Math.max(0, tickerPos - 400), tickerPos);
    const segments = before.split(/\n|\r|\s{2,}/).map((s) => s.trim()).filter(Boolean);

    // Pattern: "LSE SS SPDR S&P 500 UCITS", "BSTK...04264 LSE SS SPDR...", or
    // "LSESS SPDR S&P 500 UCITS" (pdf-parse v1 drops the inter-column space, so
    // the exchange code is glued to the name with no separator — and no word
    // boundary either, which is why \s+/\b-anchored matching missed it). We
    // therefore strip any leading contract number, then match the exchange code
    // at the START of the segment with optional (\s*) whitespace before the name.
    const exchPrefixRe = new RegExp(
      `^(${Object.keys(EXCHANGE_MAP).join("|")})\\s*(.+)`,
    );

    const nameParts: string[] = [];
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];

      // Case A: segment starts (optionally after a contract number) with an
      // exchange code — possibly glued to the name. Rest is the name start.
      const segNoContract = seg.replace(/^[A-Z]{3,}\d{10,}\s*/, "");
      const prefixMatch = segNoContract.match(exchPrefixRe);
      if (prefixMatch) {
        exchange = EXCHANGE_MAP[prefixMatch[1]] ?? prefixMatch[1];
        const namePart = prefixMatch[2].trim();
        if (namePart) nameParts.unshift(namePart);
        break;
      }

      // Case B: segment IS an exchange code (alone on its own line)
      const soloExch = EXCHANGE_PATTERN.exec(seg);
      if (soloExch && seg.trim() === soloExch[1]) {
        exchange = EXCHANGE_MAP[soloExch[1]] ?? soloExch[1];
        if (nameParts.length > 0) break;
        continue;
      }

      // Case C: non-name delimiter (date, bare number, payment method keyword)
      const isDelimiter =
        seg.length <= 2 ||
        /^\d[\d.,\s]*$/.test(seg) ||
        /^(RSP|Cash|Account|SGD|USD|EUR|GBP|HKD|AUD)$/i.test(seg) ||
        /^\d{1,2}\s+\w{3,9}\s+\d{4}$/.test(seg);
      if (isDelimiter) {
        if (nameParts.length > 0) break;
        continue;
      }

      // Normal name segment
      nameParts.unshift(seg);
    }
    if (nameParts.length > 0) name = nameParts.join(" ").trim();
  }

  if (!exchange) warnings.push("Could not detect exchange.");

  // ── Prices: scan the whole document for "CCY AMOUNT" ────────────────────
  const ccyAmounts = [
    ...text.matchAll(/\b(USD|SGD|EUR|GBP|HKD|AUD)[ \t]*\n?[ \t]*([\d,]+\.\d+)/g),
  ];

  let currency = "SGD";
  let price = 0;
  let units = 0;
  let fxRate = 1;

  const decOf = (s: string) => (s.includes(".") ? s.split(".")[1].length : 0);
  const nonSgdAmounts = ccyAmounts.filter((m) => m[1] !== "SGD");

  if (nonSgdAmounts.length > 0) {
    currency = nonSgdAmounts[0][1];

    // Transaction total = first positive non-SGD amount with ≤ 2 decimal places
    // (FSMOne totals like "759.64"; fees "0.00" are excluded by the > 0 check)
    const totalEntry = nonSgdAmounts.find(
      (m) => decOf(m[2]) <= 2 && parseFloat(m[2].replace(/,/g, "")) > 0,
    );

    // Unit price = non-SGD amount with most decimal places (≥ 4, e.g. "18.365287")
    const byDp = [...nonSgdAmounts].sort((a, b) => decOf(b[2]) - decOf(a[2]));
    if (decOf(byDp[0][2]) >= 4) {
      price = parseFloat(byDp[0][2].replace(/,/g, ""));
    } else if (totalEntry) {
      // Unit price is a bare number in the PDF stream (no "USD" on the same line).
      // It appears immediately before the transaction total in the text.
      const totalPos = text.indexOf(totalEntry[0]);
      const beforeTotal = text.substring(Math.max(0, totalPos - 200), totalPos);
      const bareMatch = beforeTotal.match(/\b(\d+\.\d{4,})\b/);
      if (bareMatch) price = parseFloat(bareMatch[1]);
    }

    if (totalEntry && price > 0) {
      const total = parseFloat(totalEntry[2].replace(/,/g, ""));
      units = Math.round((total / price) * 10000) / 10000;
    }
  }

  // ── Units fallback: standalone number before the first CCY match ──────────
  if (units <= 0 && ccyAmounts.length > 0) {
    const firstCcyPos = text.indexOf(ccyAmounts[0][0]);
    const beforeCcy = text.substring(Math.max(0, firstCcyPos - 200), firstCcyPos);
    const qtyMatch = beforeCcy.match(/\b(\d+\.?\d*)\s*[\n\r\s]*$/);
    if (qtyMatch) units = parseFloat(qtyMatch[1]);
  }
  if (units <= 0) warnings.push("Could not parse quantity.");

  // ── FX rate: small decimal after the last SGD amount ─────────────────────
  if (currency !== "SGD") {
    const sgdAmounts = ccyAmounts.filter((m) => m[1] === "SGD");
    if (sgdAmounts.length > 0) {
      const lastSgdStr = sgdAmounts[sgdAmounts.length - 1][0];
      const afterSgd = text.substring(text.lastIndexOf(lastSgdStr) + lastSgdStr.length);
      const fxMatch = afterSgd.match(/\b(\d+\.\d{4,8})\b/);
      if (fxMatch) {
        const candidate = parseFloat(fxMatch[1]);
        if (candidate > 0.05 && candidate < 10) fxRate = 1 / candidate;
      }
    }
    if (fxRate === 1) {
      warnings.push("Could not parse FX rate — defaulting to 1. Please correct before importing.");
    }
  }

  if (price <= 0) warnings.push("Could not parse transacted price.");

  const trade: ParsedTrade = {
    name,
    ticker,
    exchange,
    asset_type: "ETF",
    broker: "FSMOne",
    units,
    currency,
    buy_price: price,
    buy_date: buyDate,
    buy_fx_rate: fxRate,
    fees: 0,
    source: "Cash",
  };

  return { broker: "FSMOne", docType: "etf-confirmation", trades: [trade], warnings };
}

// ── Consolidated Monthly Statement ───────────────────────────────────────────

// Build a ticker/exchange lookup from the Cash Account section
// Remarks like "RSP: G3B Amova STI ETF S$D (SGX)" give us ticker + exchange
function buildTickerLookup(text: string): Map<string, { ticker: string; exchange: string }> {
  const map = new Map<string, { ticker: string; exchange: string }>();
  const pattern = /RSP:\s*([A-Z0-9]{2,6})\s+(.+?)\s+\((\w+)\)/g;
  for (const m of text.matchAll(pattern)) {
    const ticker = m[1];
    const productName = m[2].trim().toLowerCase();
    const rawExchange = m[3].toUpperCase();
    const exchange = EXCHANGE_MAP[rawExchange] ?? rawExchange;
    map.set(productName, { ticker, exchange });
  }
  return map;
}

// Extract FX reference rates from the statement (e.g. USD/SGD 1.275300)
function buildFxLookup(text: string): Map<string, number> {
  const map = new Map<string, number>();
  const pattern = /([A-Z]{3})\/SGD\s+([\d.]+)/g;
  for (const m of text.matchAll(pattern)) {
    map.set(m[1], parseFloat(m[2])); // e.g. "USD" → 1.2753
  }
  return map;
}

function parseConsolidatedStatement(text: string): ParseResult {
  const warnings: string[] = [];
  const trades: ParsedTrade[] = [];

  const tickerLookup = buildTickerLookup(text);
  const fxLookup = buildFxLookup(text);

  // Find the transactions section
  const txnIdx = text.indexOf("TRANSACTIONS MADE IN THE MONTH");
  if (txnIdx < 0) {
    warnings.push("Could not find 'TRANSACTIONS MADE IN THE MONTH' section.");
    return { broker: "FSMOne", docType: "consolidated-statement", trades, warnings };
  }

  const txnSection = text.substring(txnIdx);

  // Process each sub-section that might have trades: Stock & ETF, Unit Trust
  const SECTIONS: { marker: string; assetType: string }[] = [
    { marker: "Stock & ETF", assetType: "ETF" },
    { marker: "Unit Trust", assetType: "Equity" },
  ];

  for (const { marker, assetType } of SECTIONS) {
    const secIdx = txnSection.indexOf(marker);
    if (secIdx < 0) continue;

    // Extract section text: from marker until next major section or "Managed Portfolio"
    const nextSec = ["Bond", "Unit Trust", "Stock & ETF", "Managed Portfolio", "iFAST Financial"]
      .map((s) => {
        const i = txnSection.indexOf(s, secIdx + marker.length);
        return i > 0 ? i : Infinity;
      })
      .filter((i) => i > secIdx + marker.length)
      .sort((a, b) => a - b)[0];

    const sectionText = txnSection.substring(
      secIdx + marker.length,
      isFinite(nextSec) ? nextSec : undefined,
    );

    if (/you have no transactions/i.test(sectionText)) continue;

    // Find each transaction by date pattern "25-May-2026"
    const datePattern = /(\d{2}-\w{3}-\d{4})/g;
    const dateMatches = [...sectionText.matchAll(datePattern)];

    for (let di = 0; di < dateMatches.length; di++) {
      const dateStr = dateMatches[di][1];
      const blockStart = dateMatches[di].index!;
      const blockEnd = di + 1 < dateMatches.length
        ? dateMatches[di + 1].index!
        : sectionText.length;
      const block = sectionText.substring(blockStart, blockEnd);

      const trade = parseConsolidatedTxnBlock(
        block, dateStr, assetType, tickerLookup, fxLookup,
      );
      if (trade) {
        trades.push(trade);
      } else {
        warnings.push(`Could not parse transaction starting on ${dateStr}.`);
      }
    }
  }

  if (trades.length === 0 && warnings.length === 0) {
    warnings.push("No trades found in consolidated statement.");
  }

  return { broker: "FSMOne", docType: "consolidated-statement", trades, warnings };
}

function parseConsolidatedTxnBlock(
  block: string,
  dateStr: string,
  defaultAssetType: string,
  tickerLookup: Map<string, { ticker: string; exchange: string }>,
  fxLookup: Map<string, number>,
): ParsedTrade | null {
  const buyDate = parseDate(dateStr);
  if (!buyDate) return null;

  // Remove the date from the start and split into lines
  const lines = block
    .substring(dateStr.length)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 3) return null;

  // Collect product name lines until we hit a line starting with a currency code
  // E.g. "SGD ETF RSP Cash SGD" starts with "SGD"
  const CCY_SET = new Set(["USD", "SGD", "EUR", "GBP", "HKD", "AUD"]);
  const ccyLineIdx = lines.findIndex((l) => CCY_SET.has(l.split(/\s/)[0]));
  if (ccyLineIdx < 0) return null;

  // Product name: everything before the CCY line (first line may be on date line)
  const nameLines = lines.slice(0, ccyLineIdx);
  const name = nameLines.join(" ").trim();
  if (!name) return null;

  // CCY line: "SGD ETF RSP Cash SGD" → first token = asset currency
  const ccyLine = lines[ccyLineIdx];
  const ccyTokens = ccyLine.split(/\s+/);
  const currency = ccyTokens[0] ?? "SGD";

  // Asset type from CCY line (2nd token if it's ETF / Unit Trust etc.)
  const assetTypeTok = ccyTokens.find((t) =>
    ["ETF", "REIT", "BOND"].includes(t.toUpperCase()),
  );
  const asset_type = assetTypeTok
    ? normalizeAssetType(assetTypeTok)
    : defaultAssetType;

  // Data lines after CCY line: amounts, quantity, price, status
  const dataLines = lines.slice(ccyLineIdx + 1);

  // Pull all numeric values from remaining lines
  // "998.53" → amount; "188 SGD" → qty; "5.305" → price; "complete" → status
  let quantity = 0;
  let price = 0;

  // Look for "NNN [CCY]" pattern = quantity line
  const qtyCcyIdx = dataLines.findIndex((l) => /^\d+\s+(USD|SGD|EUR|GBP|HKD|AUD)$/.test(l));
  if (qtyCcyIdx >= 0) {
    const qtyMatch = dataLines[qtyCcyIdx].match(/^(\d+)/);
    if (qtyMatch) quantity = parseFloat(qtyMatch[1]);
    // Price is on the next line
    if (qtyCcyIdx + 1 < dataLines.length) {
      const priceCandidate = parseFloat(dataLines[qtyCcyIdx + 1]);
      if (!isNaN(priceCandidate) && priceCandidate > 0) price = priceCandidate;
    }
  } else {
    // Fallback: collect all numeric-only lines and take the last two
    const nums = dataLines
      .filter((l) => /^[\d,.]+$/.test(l))
      .map((l) => parseFloat(l.replace(/,/g, "")))
      .filter((n) => !isNaN(n) && n > 0);
    if (nums.length >= 2) {
      quantity = nums[nums.length - 2];
      price = nums[nums.length - 1];
    }
  }

  if (quantity <= 0 || price <= 0) return null;

  // FX rate
  const fxRate = currency === "SGD" ? 1 : (fxLookup.get(currency) ?? 1);

  // Ticker + exchange from cash account lookup
  const nameLower = name.toLowerCase();
  let ticker = "";
  let exchange = currency === "SGD" ? "SI" : "US";
  for (const [key, val] of tickerLookup) {
    if (nameLower.includes(key)) {
      ticker = val.ticker;
      exchange = val.exchange || exchange;
      break;
    }
  }

  return {
    name,
    ticker,
    exchange,
    asset_type,
    broker: "FSMOne",
    units: quantity,
    currency,
    buy_price: price,
    buy_date: buyDate,
    buy_fx_rate: fxRate,
    fees: 0,
    source: "Cash",
  };
}

// ── Public entry point ────────────────────────────────────────────────────────

export function parseFsmone(text: string): ParseResult {
  const isConfirmation = /Confirmation Note/i.test(text) && /FUNDSUPERMART|iFAST/i.test(text);
  const isEtf = /Exchange Traded Funds/i.test(text);
  const isConsolidated = /CONSOLIDATED FINANCIAL POSITIONS/i.test(text);
  const isUnitTrust = /Unit Trust \/ Cash Solutions/i.test(text);

  if (isConfirmation && isEtf) {
    return parseEtfConfirmationNote(text);
  }
  if (isConsolidated) {
    return parseConsolidatedStatement(text);
  }
  if (isConfirmation && isUnitTrust) {
    if (/Cash Account Transfer/i.test(text)) {
      return {
        broker: "FSMOne",
        docType: "cash-transfer",
        trades: [],
        warnings: ["Cash transfer confirmation — no trades to import."],
      };
    }
    return {
      broker: "FSMOne",
      docType: "unit-trust-confirmation",
      trades: [],
      warnings: ["Unit trust confirmation parsing is not yet supported."],
    };
  }
  return {
    broker: "FSMOne",
    docType: "unknown",
    trades: [],
    warnings: ["Unrecognised FSMOne document type."],
  };
}

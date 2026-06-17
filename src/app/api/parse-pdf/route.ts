import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/guards";
import { enforceRateLimit } from "@/lib/supabase/rate-limit";
import { parsePdfText } from "@/lib/pdf-parsers";
import { fetchEodhdAssetTypes } from "@/lib/prices";

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const limited = await enforceRateLimit("parse-pdf", 5, 60, { failClosed: true });
  if (limited) return limited;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let pdfText = "";

  const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;

  if (isPdf) {
    try {
      // pdfjs-dist legacy build has no native dependencies — works on Vercel.
      // pdf-parse v2 pulls in @napi-rs/canvas (native binary) which fails on
      // Linux serverless because only the Windows binary was installed locally.
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "";
      const doc = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        disableFontFace: true,
        verbosity: 0,
      }).promise;
      const pageTexts: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        pageTexts.push(
          content.items
            .map((item) => ("str" in item ? (item as { str: string }).str : ""))
            .join(" "),
        );
        page.cleanup();
      }
      await doc.destroy();
      pdfText = pageTexts.join("\n");
    } catch (err) {
      console.error("[parse-pdf] PDF parsing failed:", err);
      return NextResponse.json(
        { error: "Could not read PDF — make sure the file is a valid, text-based PDF." },
        { status: 422 },
      );
    }
  } else {
    // Chrome/Edge on Windows saves PDFs as HTML when using Save Page As.
    // The rendered text is present as HTML text nodes — strip tags to recover it.
    const html = buffer.toString("utf-8");
    const looksLikeHtml = /<!doctype\s+html|<html[\s>]/i.test(html);
    if (!looksLikeHtml) {
      return NextResponse.json(
        { error: "Could not read file — make sure it is a valid PDF." },
        { status: 422 },
      );
    }
    pdfText = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (!pdfText.trim()) {
    return NextResponse.json(
      { error: "PDF appears to be a scanned image — only text-based PDFs are supported." },
      { status: 422 },
    );
  }

  const result = parsePdfText(pdfText);

  // Enrich asset types from EODHD: broker statements (esp. DBS Vickers contract
  // notes) often lack an asset descriptor, so an ETF lands as "Equity". This
  // only ever upgrades to ETF (EODHD reports REITs as stock), so it never
  // clobbers a type the parser detected from statement text. Best-effort — a
  // failure or missing key leaves parser defaults for the refresh heal to fix.
  if (result.trades.length > 0) {
    const etfTypes = await fetchEodhdAssetTypes(
      result.trades.map((t) => t.ticker),
    );
    for (const trade of result.trades) {
      const detected = etfTypes[trade.ticker];
      if (detected) trade.asset_type = detected;
    }
  }

  return NextResponse.json(result);
}

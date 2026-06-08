import { fetchLivePrices } from "@/lib/prices";

export async function POST(req: Request) {
  const { tickers }: { tickers: string[] } = await req.json();
  const prices = await fetchLivePrices(tickers);
  return Response.json(prices);
}

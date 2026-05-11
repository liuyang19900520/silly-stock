import { NextResponse } from "next/server";
import { fetchMarketSnapshot } from "@/lib/stocks/live-data";

type RouteContext = {
  params: Promise<{ symbol: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { symbol } = await context.params;

  if (!symbol) {
    return NextResponse.json({ error: "Missing stock symbol" }, { status: 400 });
  }

  return NextResponse.json(await fetchMarketSnapshot(symbol));
}

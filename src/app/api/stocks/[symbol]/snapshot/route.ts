import { NextResponse } from "next/server";
import { fetchMarketSnapshot } from "@/features/market-data/server/fetch-market-snapshot";

type RouteContext = {
  params: Promise<{ symbol: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { symbol } = await context.params;

  if (!symbol) {
    return NextResponse.json({ error: "Missing stock symbol" }, { status: 400 });
  }

  try {
    return NextResponse.json(await fetchMarketSnapshot(symbol));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Market data is currently unavailable.",
      },
      { status: 503 },
    );
  }
}

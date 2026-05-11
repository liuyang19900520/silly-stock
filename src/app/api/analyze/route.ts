import { NextResponse } from "next/server";
import { matchRules, summarizeMatches } from "@/lib/rules/match-rules";
import { parseRules } from "@/lib/rules/parse-rules";
import { fetchMarketSnapshot } from "@/lib/stocks/live-data";

type AnalyzeBody = {
  symbol?: string;
  rulesDocument?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AnalyzeBody;
  const symbol = body.symbol?.trim().toUpperCase();

  if (!symbol) {
    return NextResponse.json({ error: "Missing stock symbol" }, { status: 400 });
  }

  const rulesDocument = body.rulesDocument ?? "";
  const snapshot = await fetchMarketSnapshot(symbol);
  let rules;

  try {
    rules = parseRules(rulesDocument);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Rules document must be valid JSON.",
      },
      { status: 400 },
    );
  }

  const matches = matchRules(snapshot, rules);
  const warnings = [
    "This tool is research support only and does not provide buy, sell, or hold advice.",
  ];

  return NextResponse.json({
    symbol,
    snapshot,
    rules,
    matches,
    conclusion: summarizeMatches(matches),
    warnings,
  });
}

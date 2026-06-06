import { MarketSnapshot } from "@/features/market-data/types";
import { StockFolder } from "./types";

export type Decision = "Overbought" | "Buy" | "Hold" | "Sell" | "Oversold";

type IndicatorConfig = {
  indicatorId?: string;
  label?: string;
  calculator?: string;
  weight?: number;
  scoring?: { when: string; score: number; reason?: string }[];
};

type StrategyConfig = {
  decisionPolicy?: {
    overboughtScore?: number;
    buyScore?: number;
    holdScore?: number;
    sellScore?: number;
    oversoldScore?: number;
  };
};

function parseJson<T>(content: string): T | null {
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function readSnapshotValue(snapshot: MarketSnapshot, calculator?: string) {
  if (!calculator) return null;

  if (calculator === "price_vs_ma100") {
    if (!snapshot.movingAverage100) return null;
    return Number(
      (((snapshot.price - snapshot.movingAverage100) / snapshot.movingAverage100) * 100).toFixed(2),
    );
  }

  if (calculator === "price_vs_ma200") {
    if (!snapshot.movingAverage200) return null;
    return Number(
      (((snapshot.price - snapshot.movingAverage200) / snapshot.movingAverage200) * 100).toFixed(2),
    );
  }

  const key = calculator as keyof MarketSnapshot;
  return typeof snapshot[key] === "number" ? (snapshot[key] as number) : null;
}

function conditionMatches(value: number, condition: string) {
  const match = condition.trim().match(/^(<=|>=|<|>|=)\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return false;

  const target = Number(match[2]);
  if (match[1] === "<=") return value <= target;
  if (match[1] === ">=") return value >= target;
  if (match[1] === "<") return value < target;
  if (match[1] === ">") return value > target;
  return value === target;
}

function decisionFromScore(score: number, strategy: StrategyConfig | null): Decision {
  const policy = strategy?.decisionPolicy ?? {};
  if (score >= (policy.overboughtScore ?? 85)) return "Overbought";
  if (score >= (policy.buyScore ?? 70)) return "Buy";
  if (score >= (policy.holdScore ?? 45)) return "Hold";
  if (score >= (policy.sellScore ?? 25)) return "Sell";
  return "Oversold";
}

export function evaluateStock(stock: StockFolder, snapshot?: MarketSnapshot) {
  const strategyFile = stock.files.find((file) => file.kind === "strategy");
  const strategy = strategyFile ? parseJson<StrategyConfig>(strategyFile.content) : null;
  const indicators = stock.files
    .filter((file) => file.kind === "indicator")
    .map((file) => parseJson<IndicatorConfig>(file.content))
    .filter((indicator): indicator is IndicatorConfig => Boolean(indicator));

  if (!snapshot || indicators.length === 0) {
    return {
      score: 50,
      decision: "Hold" as Decision,
      reason: "Waiting for market data or indicator configuration.",
    };
  }

  let weightedScore = 0;
  let totalWeight = 0;
  const reasons: string[] = [];

  for (const indicator of indicators) {
    const weight = indicator.weight ?? 10;
    const value = readSnapshotValue(snapshot, indicator.calculator);
    const matchedRule =
      value === null
        ? null
        : indicator.scoring?.find((rule) => conditionMatches(value, rule.when));
    const score = matchedRule?.score ?? 50;

    weightedScore += score * weight;
    totalWeight += weight;
    reasons.push(
      value === null
        ? `${indicator.label ?? indicator.indicatorId}: market snapshot does not include ${indicator.calculator}; using neutral score.`
        : `${indicator.label ?? indicator.indicatorId}: ${value} / ${matchedRule?.reason ?? "No rule matched; using neutral score."}`,
    );
  }

  const score = totalWeight ? Math.round(weightedScore / totalWeight) : 50;
  return {
    score,
    decision: decisionFromScore(score, strategy),
    reason: reasons[0] ?? "No indicator explanation.",
  };
}

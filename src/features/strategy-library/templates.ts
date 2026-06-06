import { StockFolder, StockMarket } from "./types";

export function now() {
  return new Date().toISOString();
}

export function detectMarket(symbol: string): StockMarket {
  const normalized = symbol.trim().toUpperCase();
  if (/^\d{4}(\.(T|JP))?$/.test(normalized)) return "JP";
  if (/^[A-Z][A-Z0-9.-]*$/.test(normalized)) return "US";
  return "UNKNOWN";
}

export function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function strategyTemplate(
  symbol: string,
  market = detectMarket(symbol),
  name = `${symbol} strategy`,
) {
  return formatJson({
    symbol,
    market,
    name,
    enabledIndicators: ["price_vs_ma100", "price_vs_ma200"],
    decisionPolicy: {
      overboughtScore: 85,
      buyScore: 70,
      holdScore: 45,
      sellScore: 25,
      oversoldScore: 15,
    },
  });
}

export function indicatorTemplate(symbol: string, indicatorId = "price_vs_ma100") {
  const movingAverageDays = indicatorId === "price_vs_ma200" ? 200 : 100;

  return formatJson({
    symbol,
    indicatorId,
    label: `Price vs ${movingAverageDays}-day moving average`,
    calculator: `price_vs_ma${movingAverageDays}`,
    weight: 20,
    params: {},
    scoring: [
      { when: ">= 8", score: 90, reason: `Price is far above the ${movingAverageDays}-day average.` },
      { when: ">= 0", score: 70, reason: `Price is above the ${movingAverageDays}-day average.` },
      { when: ">= -5", score: 45, reason: `Price is slightly below the ${movingAverageDays}-day average.` },
      { when: "< -5", score: 20, reason: `Price is meaningfully below the ${movingAverageDays}-day average.` },
    ],
  });
}

export function createStock(symbol: string, name?: string): StockFolder {
  const normalized = symbol.trim().toUpperCase();
  const market = detectMarket(normalized);
  const stockName = name?.trim() || `${normalized} Research Folder`;

  return {
    symbol: normalized,
    market,
    name: stockName,
    files: [
      {
        id: `${normalized}:strategy`,
        name: "strategy.json",
        kind: "strategy",
        content: strategyTemplate(normalized, market, stockName),
        updatedAt: now(),
      },
      {
        id: `${normalized}:indicator:price_vs_ma100`,
        name: "indicators/price_vs_ma100.json",
        kind: "indicator",
        content: indicatorTemplate(normalized),
        updatedAt: now(),
      },
      {
        id: `${normalized}:indicator:price_vs_ma200`,
        name: "indicators/price_vs_ma200.json",
        kind: "indicator",
        content: indicatorTemplate(normalized, "price_vs_ma200"),
        updatedAt: now(),
      },
    ],
  };
}

type StockSnapshot = {
  symbol: string;
  companyName: string;
  price: number;
  currency: string;
  changePercent: number;
  peRatio: number;
  roe: number;
  revenueGrowth: number;
  ma200: number;
  volatility30d: number;
  newsSentiment: "positive" | "neutral" | "negative";
  source: string;
  updatedAt: string;
};

const now = () => new Date().toISOString();

const snapshots: Record<string, Omit<StockSnapshot, "updatedAt">> = {
  AAPL: {
    symbol: "AAPL",
    companyName: "Apple Inc.",
    price: 183.42,
    currency: "USD",
    changePercent: 1.18,
    peRatio: 28.6,
    roe: 1.42,
    revenueGrowth: 0.061,
    ma200: 177.13,
    volatility30d: 0.19,
    newsSentiment: "positive",
    source: "Mock provider, replace with Alpha Vantage or Finnhub",
  },
  NVDA: {
    symbol: "NVDA",
    companyName: "NVIDIA Corporation",
    price: 921.77,
    currency: "USD",
    changePercent: 2.43,
    peRatio: 68.2,
    roe: 0.93,
    revenueGrowth: 1.25,
    ma200: 701.34,
    volatility30d: 0.34,
    newsSentiment: "positive",
    source: "Mock provider, replace with Alpha Vantage or Finnhub",
  },
  MSFT: {
    symbol: "MSFT",
    companyName: "Microsoft Corporation",
    price: 427.85,
    currency: "USD",
    changePercent: 0.64,
    peRatio: 36.4,
    roe: 0.37,
    revenueGrowth: 0.17,
    ma200: 399.21,
    volatility30d: 0.16,
    newsSentiment: "neutral",
    source: "Mock provider, replace with Alpha Vantage or Finnhub",
  },
  TSLA: {
    symbol: "TSLA",
    companyName: "Tesla, Inc.",
    price: 176.1,
    currency: "USD",
    changePercent: -1.92,
    peRatio: 47.8,
    roe: 0.13,
    revenueGrowth: -0.086,
    ma200: 209.47,
    volatility30d: 0.41,
    newsSentiment: "negative",
    source: "Mock provider, replace with Alpha Vantage or Finnhub",
  },
};

export function getStockSnapshot(symbol: string): StockSnapshot {
  const normalized = symbol.trim().toUpperCase();
  const stock = snapshots[normalized] ?? {
    symbol: normalized,
    companyName: `${normalized} Research Candidate`,
    price: 128.35,
    currency: "USD",
    changePercent: 0.42,
    peRatio: 24.1,
    roe: 0.18,
    revenueGrowth: 0.096,
    ma200: 121.9,
    volatility30d: 0.23,
    newsSentiment: "neutral" as const,
    source: "Mock provider, replace with Alpha Vantage or Finnhub",
  };

  return {
    ...stock,
    updatedAt: now(),
  };
}

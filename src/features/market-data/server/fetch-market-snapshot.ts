import { MarketSnapshot, StockMarket } from "../types";

type MarketIdentity = {
  market: StockMarket;
  displaySymbol: string;
  yahooSymbol: string;
  defaultCurrency: string;
};

type YahooChart = {
  meta?: {
    currency?: string;
    symbol?: string;
    longName?: string;
    shortName?: string;
  };
  timestamp?: number[];
  indicators?: {
    quote?: {
      open?: Array<number | null>;
      high?: Array<number | null>;
      low?: Array<number | null>;
      close?: Array<number | null>;
      volume?: Array<number | null>;
    }[];
  };
};

function detectMarket(symbol: string): MarketIdentity {
  const raw = symbol.trim().toUpperCase();
  const withoutTokyoSuffix = raw.replace(/\.(T|JP)$/, "");

  if (/^\d{4}$/.test(withoutTokyoSuffix)) {
    return {
      market: "JP",
      displaySymbol: `${withoutTokyoSuffix}.T`,
      yahooSymbol: `${withoutTokyoSuffix}.T`,
      defaultCurrency: "JPY",
    };
  }

  if (/^[A-Z][A-Z0-9.-]{0,9}(\.US)?$/.test(raw)) {
    const usSymbol = raw.replace(/\.US$/, "");
    return {
      market: "US",
      displaySymbol: usSymbol,
      yahooSymbol: usSymbol,
      defaultCurrency: "USD",
    };
  }

  return {
    market: "UNKNOWN",
    displaySymbol: raw,
    yahooSymbol: raw,
    defaultCurrency: "USD",
  };
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function numberAt(values: Array<number | null> | undefined, index: number) {
  const value = values?.[index];
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

export async function fetchMarketSnapshot(symbol: string): Promise<MarketSnapshot> {
  const identity = detectMarket(symbol);
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    identity.yahooSymbol,
  )}?range=1y&interval=1d`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; SillyStock/1.0)",
    },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    chart?: { result?: YahooChart[]; error?: { description?: string } | null };
  };
  const chart = payload.chart?.result?.[0];
  const quote = chart?.indicators?.quote?.[0];
  const closes = quote?.close ?? [];
  const latestIndex = closes.findLastIndex(
    (value) => typeof value === "number" && !Number.isNaN(value),
  );

  if (!chart || !quote || latestIndex < 0) {
    throw new Error(
      payload.chart?.error?.description ??
        `No Yahoo Finance market data available for ${identity.displaySymbol}.`,
    );
  }

  const price = numberAt(closes, latestIndex);
  const open = numberAt(quote.open, latestIndex);
  const high = numberAt(quote.high, latestIndex);
  const low = numberAt(quote.low, latestIndex);
  const volume = numberAt(quote.volume, latestIndex);
  const validCloses = closes.filter(
    (value): value is number => typeof value === "number" && !Number.isNaN(value),
  );
  const previousPrice = validCloses.at(-2) ?? price;

  if (price === null || open === null || high === null || low === null || volume === null) {
    throw new Error(`Yahoo Finance market data for ${identity.displaySymbol} is incomplete.`);
  }

  return {
    symbol: chart.meta?.symbol ?? identity.displaySymbol,
    market: identity.market,
    name: chart.meta?.longName ?? chart.meta?.shortName ?? identity.displaySymbol,
    price: Number(price.toFixed(2)),
    open: Number(open.toFixed(2)),
    high: Number(high.toFixed(2)),
    low: Number(low.toFixed(2)),
    movingAverage100: average(validCloses.slice(-100)),
    movingAverage200: average(validCloses.slice(-200)),
    volume,
    changePercent: previousPrice
      ? Number((((price - previousPrice) / previousPrice) * 100).toFixed(2))
      : 0,
    currency: chart.meta?.currency ?? identity.defaultCurrency,
    source: `Yahoo Finance daily chart (${identity.market})`,
    updatedAt: new Date((chart.timestamp?.[latestIndex] ?? Date.now() / 1000) * 1000).toISOString(),
  };
}

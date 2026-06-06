import { MarketSnapshot, StockMarket } from "../types";

type StooqRow = {
  Symbol: string;
  Date: string;
  Time: string;
  Open: string;
  High: string;
  Low: string;
  Close: string;
  Volume: string;
  Name: string;
};

type MarketIdentity = {
  market: StockMarket;
  displaySymbol: string;
  stooqSymbol: string;
  yahooSymbol: string;
  currency: string;
};

function detectMarket(symbol: string): MarketIdentity {
  const raw = symbol.trim().toUpperCase();
  const withoutTokyoSuffix = raw.replace(/\.(T|JP)$/, "");

  if (/^\d{4}$/.test(withoutTokyoSuffix)) {
    return {
      market: "JP",
      displaySymbol: `${withoutTokyoSuffix}.T`,
      stooqSymbol: `${withoutTokyoSuffix}.jp`,
      yahooSymbol: `${withoutTokyoSuffix}.T`,
      currency: "JPY",
    };
  }

  if (/^[A-Z][A-Z0-9.-]{0,9}(\.US)?$/.test(raw)) {
    const usSymbol = raw.replace(/\.US$/, "");

    return {
      market: "US",
      displaySymbol: usSymbol,
      stooqSymbol: `${usSymbol.toLowerCase()}.us`,
      yahooSymbol: usSymbol,
      currency: "USD",
    };
  }

  return {
    market: "UNKNOWN",
    displaySymbol: raw,
    stooqSymbol: raw.toLowerCase(),
    yahooSymbol: raw,
    currency: "USD",
  };
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function parseStooqCsv(csv: string): StooqRow | null {
  const [headerLine, rowLine] = csv.trim().split("\n");

  if (!headerLine || !rowLine || rowLine.includes("N/D")) {
    return null;
  }

  const headers = parseCsvLine(headerLine);
  const values = parseCsvLine(rowLine);

  return Object.fromEntries(headers.map((header, index) => [header, values[index]])) as StooqRow;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

async function fetchMovingAverages(yahooSymbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol,
  )}?range=1y&interval=1d`;
  const response = await fetch(url, { next: { revalidate: 3600 } });

  if (!response.ok) {
    throw new Error("Historical market data request failed.");
  }

  const payload = (await response.json()) as {
    chart?: { result?: { indicators?: { quote?: { close?: Array<number | null> }[] } }[] };
  };
  const closes =
    payload.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(
      (value): value is number => typeof value === "number" && !Number.isNaN(value),
    ) ?? [];

  return {
    movingAverage100: average(closes.slice(-100)),
    movingAverage200: average(closes.slice(-200)),
  };
}

export async function fetchMarketSnapshot(symbol: string): Promise<MarketSnapshot> {
  const identity = detectMarket(symbol);
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(
    identity.stooqSymbol,
  )}&f=sd2t2ohlcvn&h&e=csv`;
  const response = await fetch(url, { next: { revalidate: 60 } });

  if (!response.ok) {
    throw new Error(`Stooq quote request failed with status ${response.status}.`);
  }

  const row = parseStooqCsv(await response.text());

  if (!row) {
    throw new Error(`No Stooq quote data available for ${identity.displaySymbol}.`);
  }

  const open = Number(row.Open);
  const price = Number(row.Close);
  const high = Number(row.High);
  const low = Number(row.Low);
  const volume = Number(row.Volume);
  const movingAverages = await fetchMovingAverages(identity.yahooSymbol);

  if ([open, price, high, low, volume].some((value) => Number.isNaN(value))) {
    throw new Error(`Stooq quote data for ${identity.displaySymbol} is incomplete.`);
  }

  return {
    symbol: identity.displaySymbol,
    market: identity.market,
    name: row.Name || identity.displaySymbol,
    price,
    open,
    high,
    low,
    movingAverage100: movingAverages.movingAverage100,
    movingAverage200: movingAverages.movingAverage200,
    volume,
    changePercent: open ? Number((((price - open) / open) * 100).toFixed(2)) : 0,
    currency: identity.currency,
    source: `Stooq delayed quote + Yahoo Finance daily chart (${identity.market})`,
    updatedAt: `${row.Date}T${row.Time || "00:00:00"}Z`,
  };
}

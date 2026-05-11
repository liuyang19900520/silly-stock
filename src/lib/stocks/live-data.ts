import { getStockSnapshot } from "./mock-data";
import { MarketSnapshot, StockMarket } from "@/lib/rules/types";

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
      currency: "JPY",
    };
  }

  if (/^[A-Z][A-Z0-9.-]{0,9}(\.US)?$/.test(raw)) {
    const usSymbol = raw.replace(/\.US$/, "");

    return {
      market: "US",
      displaySymbol: usSymbol,
      stooqSymbol: `${usSymbol.toLowerCase()}.us`,
      currency: "USD",
    };
  }

  return {
    market: "UNKNOWN",
    displaySymbol: raw,
    stooqSymbol: raw.toLowerCase(),
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

function fallbackSnapshot(identity: MarketIdentity): MarketSnapshot {
  const fallback = getStockSnapshot(identity.displaySymbol);

  return {
    symbol: identity.displaySymbol,
    market: identity.market,
    name: fallback.companyName,
    price: fallback.price,
    open: fallback.price / (1 + fallback.changePercent / 100),
    high: Math.max(fallback.price, fallback.ma200),
    low: Math.min(fallback.price, fallback.ma200),
    volume: 1200000,
    changePercent: fallback.changePercent,
    currency: identity.currency,
    source: fallback.source,
    updatedAt: fallback.updatedAt,
  };
}

export async function fetchMarketSnapshot(symbol: string): Promise<MarketSnapshot> {
  const identity = detectMarket(symbol);
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(
    identity.stooqSymbol,
  )}&f=sd2t2ohlcvn&h&e=csv`;

  try {
    const response = await fetch(url, { next: { revalidate: 60 } });

    if (!response.ok) {
      throw new Error("Market data request failed.");
    }

    const row = parseStooqCsv(await response.text());

    if (!row) {
      throw new Error("Market data not available.");
    }

    const open = Number(row.Open);
    const price = Number(row.Close);

    return {
      symbol: identity.displaySymbol,
      market: identity.market,
      name: row.Name || identity.displaySymbol,
      price,
      open,
      high: Number(row.High),
      low: Number(row.Low),
      volume: Number(row.Volume),
      changePercent: open ? Number((((price - open) / open) * 100).toFixed(2)) : 0,
      currency: identity.currency,
      source: `Stooq delayed CSV quote (${identity.market})`,
      updatedAt: `${row.Date}T${row.Time || "00:00:00"}Z`,
    };
  } catch {
    return fallbackSnapshot(identity);
  }
}

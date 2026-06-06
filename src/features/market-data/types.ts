export type StockMarket = "US" | "JP" | "UNKNOWN";

export type MarketSnapshot = {
  symbol: string;
  market: StockMarket;
  name: string;
  price: number;
  open: number;
  high: number;
  low: number;
  movingAverage100: number | null;
  movingAverage200: number | null;
  volume: number;
  changePercent: number;
  currency: string;
  source: string;
  updatedAt: string;
};

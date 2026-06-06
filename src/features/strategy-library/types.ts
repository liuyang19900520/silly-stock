export type JsonFileKind = "strategy" | "indicator";

export type JsonFile = {
  id: string;
  name: string;
  kind: JsonFileKind;
  content: string;
  updatedAt: string;
};

export type StockMarket = "US" | "JP" | "UNKNOWN";

export type StockFolder = {
  symbol: string;
  market: StockMarket;
  name: string;
  files: JsonFile[];
};

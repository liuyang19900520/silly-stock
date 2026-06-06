import { JsonFileKind, StockFolder, StockMarket } from "./types";

const markets = new Set<StockMarket>(["US", "JP", "UNKNOWN"]);
const safeSymbol = /^[A-Z0-9][A-Z0-9.-]{0,15}$/;
const safeFileName = /^(strategy\.json|indicators\/[a-zA-Z0-9][a-zA-Z0-9_-]*\.json)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseStrategyLibrary(value: unknown): StockFolder[] {
  if (!Array.isArray(value)) {
    throw new Error("library must be an array.");
  }

  const symbols = new Set<string>();

  return value.map((stock, stockIndex) => {
    if (!isRecord(stock)) {
      throw new Error(`library[${stockIndex}] must be an object.`);
    }

    const symbol = typeof stock.symbol === "string" ? stock.symbol.trim().toUpperCase() : "";
    const market = stock.market as StockMarket;
    const name = typeof stock.name === "string" ? stock.name.trim() : "";

    if (!safeSymbol.test(symbol)) {
      throw new Error(`library[${stockIndex}].symbol is invalid.`);
    }
    if (symbols.has(symbol)) {
      throw new Error(`Duplicate stock symbol: ${symbol}.`);
    }
    if (!markets.has(market)) {
      throw new Error(`library[${stockIndex}].market is invalid.`);
    }
    if (!name) {
      throw new Error(`library[${stockIndex}].name is required.`);
    }
    if (!Array.isArray(stock.files)) {
      throw new Error(`library[${stockIndex}].files must be an array.`);
    }

    symbols.add(symbol);
    const fileNames = new Set<string>();
    const files = stock.files.map((file, fileIndex) => {
      if (!isRecord(file)) {
        throw new Error(`library[${stockIndex}].files[${fileIndex}] must be an object.`);
      }

      const id = typeof file.id === "string" ? file.id : "";
      const fileName = typeof file.name === "string" ? file.name : "";
      const kind = file.kind as JsonFileKind;
      const content = typeof file.content === "string" ? file.content : "";
      const updatedAt = typeof file.updatedAt === "string" ? file.updatedAt : "";

      if (!id || !safeFileName.test(fileName)) {
        throw new Error(`Invalid JSON file at ${symbol}[${fileIndex}].`);
      }
      if (fileNames.has(fileName)) {
        throw new Error(`Duplicate file ${fileName} for ${symbol}.`);
      }
      if (kind !== "strategy" && kind !== "indicator") {
        throw new Error(`Invalid file kind for ${symbol}/${fileName}.`);
      }
      if (
        (fileName === "strategy.json" && kind !== "strategy") ||
        (fileName !== "strategy.json" && kind !== "indicator")
      ) {
        throw new Error(`File kind does not match ${symbol}/${fileName}.`);
      }

      try {
        JSON.parse(content);
      } catch {
        throw new Error(`${symbol}/${fileName} must contain valid JSON.`);
      }

      fileNames.add(fileName);
      return { id, name: fileName, kind, content, updatedAt };
    });

    return { symbol, market, name, files };
  });
}

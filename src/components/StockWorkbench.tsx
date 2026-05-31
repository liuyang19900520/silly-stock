"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "@/app/page.module.css";
import {
  createStock,
  formatJson,
  indicatorTemplate,
  now,
  strategyTemplate,
} from "@/lib/strategy-library/templates";
import { JsonFile, StockFolder } from "@/lib/strategy-library/types";

type ViewMode = "manage" | "dashboard";
type Decision = "Overbought" | "Buy" | "Hold" | "Sell" | "Oversold";

type MarketSnapshot = {
  symbol: string;
  market: StockFolder["market"];
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

type SnapshotResult = {
  snapshot?: MarketSnapshot;
  error?: string;
};

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

function validateJson(content: string) {
  try {
    JSON.parse(content);
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid JSON";
  }
}

function readSnapshotValue(snapshot: MarketSnapshot, calculator?: string) {
  if (!calculator) return null;
  if (calculator === "price_vs_ma100") {
    if (!snapshot.movingAverage100) return null;
    return Number((((snapshot.price - snapshot.movingAverage100) / snapshot.movingAverage100) * 100).toFixed(2));
  }
  if (calculator === "price_vs_ma200") {
    if (!snapshot.movingAverage200) return null;
    return Number((((snapshot.price - snapshot.movingAverage200) / snapshot.movingAverage200) * 100).toFixed(2));
  }
  const key = calculator as keyof MarketSnapshot;
  return typeof snapshot[key] === "number" ? (snapshot[key] as number) : null;
}

function conditionMatches(value: number, condition: string) {
  const trimmed = condition.trim();
  const match = trimmed.match(/^(<=|>=|<|>|=)\s*(-?\d+(?:\.\d+)?)$/);
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

function evaluateStock(stock: StockFolder, snapshot?: MarketSnapshot) {
  const strategyFile = stock.files.find((file) => file.kind === "strategy");
  const strategy = strategyFile ? parseJson<StrategyConfig>(strategyFile.content) : null;
  const indicators = stock.files
    .filter((file) => file.kind === "indicator")
    .map((file) => parseJson<IndicatorConfig>(file.content))
    .filter((indicator): indicator is IndicatorConfig => Boolean(indicator));

  if (!snapshot || indicators.length === 0) {
    return { score: 50, decision: "Hold" as Decision, reason: "Waiting for market data or indicator configuration." };
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

export default function StockWorkbench() {
  const [library, setLibrary] = useState<StockFolder[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [selectedFileId, setSelectedFileId] = useState("");
  const [draft, setDraft] = useState("");
  const [newSymbol, setNewSymbol] = useState("");
  const [message, setMessage] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("manage");
  const [snapshots, setSnapshots] = useState<Record<string, SnapshotResult>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLibraryLoading, setIsLibraryLoading] = useState(true);
  const [isSavingLibrary, setIsSavingLibrary] = useState(false);

  const selectedStock = library.find((stock) => stock.symbol === selectedSymbol) ?? library[0];
  const selectedFile =
    selectedStock?.files.find((file) => file.id === selectedFileId) ?? selectedStock?.files[0];
  const jsonError = validateJson(draft);

  const stockSummary = useMemo(
    () =>
      library.map((stock) => ({
        ...stock,
        indicatorCount: stock.files.filter((file) => file.kind === "indicator").length,
      })),
    [library],
  );

  const dashboardRows = useMemo(
    () =>
      library.map((stock) => ({
        stock,
        snapshot: snapshots[stock.symbol]?.snapshot,
        error: snapshots[stock.symbol]?.error,
        evaluation: evaluateStock(stock, snapshots[stock.symbol]?.snapshot),
      })),
    [library, snapshots],
  );

  useEffect(() => {
    async function loadLibrary() {
      setIsLibraryLoading(true);

      try {
        const response = await fetch("/api/strategy-library");
        const body = (await response.json()) as { library?: StockFolder[]; error?: string };

        if (!response.ok) {
          throw new Error(body.error ?? "Failed to load strategy library.");
        }

        const next = body.library ?? [];
        setLibrary(next);
        setSelectedSymbol(next[0]?.symbol ?? "");
        setSelectedFileId(next[0]?.files[0]?.id ?? "");
        setDraft(next[0]?.files[0]?.content ?? "");
        setMessage(next.length ? "Strategy library loaded from S3." : "S3 library is empty. Add a stock template.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load strategy library.");
      } finally {
        setIsLibraryLoading(false);
      }
    }

    void loadLibrary();
  }, []);

  async function persist(next: StockFolder[], successMessage: string) {
    const previous = library;

    setLibrary(next);
    setIsSavingLibrary(true);
    setMessage("Saving strategy library to S3...");

    try {
      const response = await fetch("/api/strategy-library", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ library: next }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save strategy library.");
      }

      setMessage(successMessage);
    } catch (error) {
      setLibrary(previous);
      setMessage(error instanceof Error ? error.message : "Failed to save strategy library.");
    } finally {
      setIsSavingLibrary(false);
    }
  }

  function openDashboard() {
    setViewMode("dashboard");
    void refreshSnapshots();
  }

  async function refreshSnapshots() {
    setIsRefreshing(true);
    setMessage("");

    try {
      const entries = await Promise.all(
        library.map(async (stock) => {
          const response = await fetch(`/api/stocks/${encodeURIComponent(stock.symbol)}/snapshot`);
          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as { error?: string } | null;
            return [
              stock.symbol,
              { error: body?.error ?? `Market data unavailable for ${stock.symbol}.` },
            ] as const;
          }
          return [stock.symbol, { snapshot: (await response.json()) as MarketSnapshot }] as const;
        }),
      );
      setSnapshots(Object.fromEntries(entries));
      setMessage("Market data refreshed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Refresh failed.");
    } finally {
      setIsRefreshing(false);
    }
  }

  function selectStock(symbol: string) {
    const stock = library.find((item) => item.symbol === symbol);
    const firstFile = stock?.files[0];
    setSelectedSymbol(symbol);
    setSelectedFileId(firstFile?.id ?? "");
    setDraft(firstFile?.content ?? "");
    setMessage("");
    setViewMode("manage");
  }

  function selectFile(file: JsonFile) {
    setSelectedFileId(file.id);
    setDraft(file.content);
    setMessage("");
  }

  function addStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = newSymbol.trim().toUpperCase();

    if (!normalized) {
      setMessage("Enter a stock symbol.");
      return;
    }

    if (library.some((stock) => stock.symbol === normalized || stock.symbol.replace(".T", "") === normalized)) {
      setMessage("This stock already exists.");
      return;
    }

    const stock = createStock(normalized);
    void persist([stock, ...library], "Stock folder saved to S3.");
    setNewSymbol("");
    setSelectedSymbol(stock.symbol);
    setSelectedFileId(stock.files[0].id);
    setDraft(stock.files[0].content);
    setMessage("Stock folder created from templates.");
    setViewMode("manage");
  }

  function addIndicator() {
    if (!selectedStock) return;
    const existingCount = selectedStock.files.filter((file) => file.kind === "indicator").length;
    const indicatorId =
      existingCount === 0
        ? "price_vs_ma100"
        : existingCount === 1
          ? "price_vs_ma200"
          : `custom_indicator_${existingCount + 1}`;
    const file: JsonFile = {
      id: `${selectedStock.symbol}:indicator:${indicatorId}:${Date.now()}`,
      name: `indicators/${indicatorId}.json`,
      kind: "indicator",
      content: indicatorTemplate(selectedStock.symbol, indicatorId),
      updatedAt: now(),
    };

    void persist(
      library.map((stock) =>
        stock.symbol === selectedStock.symbol ? { ...stock, files: [...stock.files, file] } : stock,
      ),
      "Indicator JSON saved to S3.",
    );
    setSelectedFileId(file.id);
    setDraft(file.content);
    setMessage("Indicator JSON template added.");
  }

  function addStrategyIfMissing() {
    if (!selectedStock || selectedStock.files.some((file) => file.kind === "strategy")) return;
    const file: JsonFile = {
      id: `${selectedStock.symbol}:strategy:${Date.now()}`,
      name: "strategy.json",
      kind: "strategy",
      content: strategyTemplate(selectedStock.symbol, selectedStock.market, selectedStock.name),
      updatedAt: now(),
    };

    void persist(
      library.map((stock) =>
        stock.symbol === selectedStock.symbol ? { ...stock, files: [file, ...stock.files] } : stock,
      ),
      "strategy.json saved to S3.",
    );
    setSelectedFileId(file.id);
    setDraft(file.content);
    setMessage("strategy.json template added.");
  }

  function saveFile() {
    if (!selectedStock || !selectedFile) return;
    if (jsonError) {
      setMessage(`Cannot save JSON yet: ${jsonError}`);
      return;
    }

    const parsed = JSON.parse(draft) as { indicatorId?: string };
    const nextName =
      selectedFile.kind === "indicator" && parsed.indicatorId
        ? `indicators/${parsed.indicatorId}.json`
        : selectedFile.name;

    void persist(
      library.map((stock) =>
        stock.symbol === selectedStock.symbol
          ? {
              ...stock,
              files: stock.files.map((file) =>
                file.id === selectedFile.id
                  ? { ...file, name: nextName, content: draft, updatedAt: now() }
                  : file,
              ),
          }
          : stock,
      ),
      "JSON saved to S3.",
    );
  }

  function formatDraftJson() {
    const parsed = parseJson<unknown>(draft);
    if (parsed === null) {
      setMessage(`Cannot format JSON: ${jsonError}`);
      return;
    }
    setDraft(formatJson(parsed));
    setMessage("JSON formatted.");
  }

  function deleteFile() {
    if (!selectedStock || !selectedFile) return;
    const nextFiles = selectedStock.files.filter((file) => file.id !== selectedFile.id);
    void persist(
      library.map((stock) =>
        stock.symbol === selectedStock.symbol ? { ...stock, files: nextFiles } : stock,
      ),
      "JSON file deleted from S3.",
    );
    setSelectedFileId(nextFiles[0]?.id ?? "");
    setDraft(nextFiles[0]?.content ?? "");
  }

  function deleteStock(symbol: string) {
    const next = library.filter((stock) => stock.symbol !== symbol);
    void persist(next, "Stock folder deleted from S3.");
    setSelectedSymbol(next[0]?.symbol ?? "");
    setSelectedFileId(next[0]?.files[0]?.id ?? "");
    setDraft(next[0]?.files[0]?.content ?? "");
  }

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div>
          <p className={styles.kicker}>Silly Stock</p>
          <h1>{viewMode === "manage" ? "Stock Strategy JSON Library" : "Stock Overview and Recommendations"}</h1>
        </div>
        <div className={styles.headerTools}>
          <div className={styles.viewTabs}>
            <button className={viewMode === "manage" ? styles.activeTab : ""} onClick={() => setViewMode("manage")}>
              Manage JSON
            </button>
            <button className={viewMode === "dashboard" ? styles.activeTab : ""} onClick={openDashboard}>
              Stock Overview
            </button>
          </div>
          <form className={styles.symbolForm} onSubmit={addStock}>
            <label htmlFor="new-symbol">Add stock</label>
            <div>
              <input
                id="new-symbol"
                value={newSymbol}
                onChange={(event) => setNewSymbol(event.target.value.toUpperCase())}
                placeholder="JNJ / 7203"
                spellCheck={false}
              />
              <button disabled={isSavingLibrary || isLibraryLoading}>Add template</button>
            </div>
          </form>
          {isLibraryLoading ? <p className={styles.statusMessage}>Loading strategy library from S3...</p> : null}
        </div>
      </section>

      {viewMode === "manage" ? (
        <section className={styles.libraryShell}>
          <aside className={styles.stockListPanel}>
            <div className={styles.panelHead}>
              <div>
                <p className={styles.kicker}>Stocks</p>
                <h2>Stock list</h2>
              </div>
              <span>{library.length}</span>
            </div>
            <div className={styles.stockCards}>
              {stockSummary.map((stock) => (
                <button
                  className={stock.symbol === selectedStock?.symbol ? styles.activeStockCard : ""}
                  key={stock.symbol}
                  onClick={() => selectStock(stock.symbol)}
                >
                  <strong>{stock.symbol}</strong>
                  <span>{stock.name}</span>
                  <small>
                    {stock.market} / {stock.indicatorCount} indicators
                  </small>
                </button>
              ))}
            </div>
          </aside>

          <aside className={styles.fileTreePanel}>
            <div className={styles.panelHead}>
              <div>
                <p className={styles.kicker}>Folder</p>
                <h2>{selectedStock?.symbol ?? "No stock"}</h2>
              </div>
              <span>{selectedStock?.files.length ?? 0} files</span>
            </div>

            {selectedStock ? (
              <>
                <div className={styles.folderMeta}>
                  <span>{selectedStock.name}</span>
                  <span>Market: {selectedStock.market}</span>
                </div>
                <div className={styles.fileActions}>
                  <button disabled={isSavingLibrary} onClick={addStrategyIfMissing}>+ strategy</button>
                  <button disabled={isSavingLibrary} onClick={addIndicator}>+ indicator</button>
                </div>
                <div className={styles.fileTree}>
                  <div className={styles.folderLine}>▾ {selectedStock.symbol}/</div>
                  {selectedStock.files.map((file) => (
                    <button
                      className={file.id === selectedFile?.id ? styles.activeFile : ""}
                      key={file.id}
                      onClick={() => selectFile(file)}
                    >
                      <span>{file.kind === "strategy" ? "◇" : "◆"}</span>
                      {file.name}
                    </button>
                  ))}
                </div>
                <button className={styles.dangerButton} disabled={isSavingLibrary} onClick={() => deleteStock(selectedStock.symbol)}>
                  Delete stock folder
                </button>
              </>
            ) : (
              <div className={styles.emptyList}>Add a stock first.</div>
            )}
          </aside>

          <section className={styles.jsonEditorPanel}>
            <div className={styles.panelHead}>
              <div>
                <p className={styles.kicker}>JSON</p>
                <h2>{selectedFile?.name ?? "No file selected"}</h2>
              </div>
              <span>{selectedFile?.kind ?? "none"}</span>
            </div>

            {selectedFile ? (
              <>
                <textarea
                  aria-label="JSON editor"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  spellCheck={false}
                />
                <div className={styles.editorFooter}>
                  <div>
                    {jsonError ? (
                      <p className={styles.error}>Invalid JSON: {jsonError}</p>
                    ) : (
                      <p className={styles.success}>JSON is valid</p>
                    )}
                    {message ? <p className={styles.statusMessage}>{message}</p> : null}
                  </div>
                  <div className={styles.editorActions}>
                    <button onClick={formatDraftJson}>Format JSON</button>
                    <button onClick={() => setDraft(selectedFile.content)}>Revert</button>
                    <button disabled={isSavingLibrary} onClick={deleteFile}>Delete JSON</button>
                    <button disabled={Boolean(jsonError) || isSavingLibrary} onClick={saveFile}>
                      {isSavingLibrary ? "Saving" : "Save"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.empty}>Select a JSON file or add a stock template.</div>
            )}
          </section>
        </section>
      ) : (
        <section className={styles.dashboardPanel}>
          <div className={styles.panelHead}>
            <div>
              <p className={styles.kicker}>Dashboard</p>
              <h2>Current stock data and strategy result</h2>
            </div>
            <button className={styles.refreshButton} disabled={isRefreshing} onClick={() => void refreshSnapshots()}>
              {isRefreshing ? "Refreshing" : "Refresh market data"}
            </button>
          </div>
          {message ? <p className={styles.statusMessage}>{message}</p> : null}
          <div className={styles.dashboardGrid}>
            {dashboardRows.map(({ stock, snapshot, error, evaluation }) => (
              <article className={styles.stockOverviewCard} key={stock.symbol}>
                <div className={styles.overviewHead}>
                  <div>
                    <strong>{snapshot?.symbol ?? stock.symbol}</strong>
                    <span>{snapshot?.name ?? stock.name}</span>
                  </div>
                  <em className={styles.decisionBadge}>{evaluation.decision}</em>
                </div>
                <div className={styles.overviewMetrics}>
                  <div>
                    <span>Market</span>
                    <strong>{snapshot?.market ?? stock.market}</strong>
                  </div>
                  <div>
                    <span>Current Price</span>
                    <strong>{snapshot ? `${snapshot.currency} ${snapshot.price.toFixed(2)}` : "--"}</strong>
                  </div>
                  <div>
                    <span>100D MA</span>
                    <strong>{snapshot?.movingAverage100 ? snapshot.movingAverage100.toFixed(2) : "--"}</strong>
                  </div>
                  <div>
                    <span>200D MA</span>
                    <strong>{snapshot?.movingAverage200 ? snapshot.movingAverage200.toFixed(2) : "--"}</strong>
                  </div>
                  <div>
                    <span>Change</span>
                    <strong className={(snapshot?.changePercent ?? 0) >= 0 ? styles.positive : styles.negative}>
                      {snapshot ? `${snapshot.changePercent.toFixed(2)}%` : "--"}
                    </strong>
                  </div>
                  <div>
                    <span>Algorithm Score</span>
                    <strong>{evaluation.score}</strong>
                  </div>
                </div>
                <p>{error ? `Data unavailable: ${error}` : evaluation.reason}</p>
                <small className={styles.dataSource}>
                  Data source: {snapshot?.source ?? "Not loaded"} / Updated: {snapshot?.updatedAt ?? "--"}
                </small>
                <div className={styles.overviewActions}>
                  <button onClick={() => selectStock(stock.symbol)}>Open JSON folder</button>
                  <button className={styles.deleteOverviewButton} disabled={isSavingLibrary} onClick={() => deleteStock(stock.symbol)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

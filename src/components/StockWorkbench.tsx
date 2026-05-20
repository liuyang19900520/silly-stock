"use client";

import { FormEvent, useMemo, useState } from "react";
import styles from "@/app/page.module.css";

type ViewMode = "manage" | "dashboard";
type JsonFileKind = "strategy" | "indicator";
type Decision = "超买" | "买入" | "持有" | "卖出" | "超卖";

type JsonFile = {
  id: string;
  name: string;
  kind: JsonFileKind;
  content: string;
  updatedAt: string;
};

type StockFolder = {
  symbol: string;
  market: "US" | "JP" | "UNKNOWN";
  name: string;
  files: JsonFile[];
};

type MarketSnapshot = {
  symbol: string;
  market: StockFolder["market"];
  name: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  changePercent: number;
  currency: string;
  source: string;
  updatedAt: string;
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

const storageKey = "silly-stock.strategy-library.v1";

function now() {
  return new Date().toISOString();
}

function detectMarket(symbol: string): StockFolder["market"] {
  const normalized = symbol.trim().toUpperCase();
  if (/^\d{4}(\.(T|JP))?$/.test(normalized)) return "JP";
  if (/^[A-Z][A-Z0-9.-]*$/.test(normalized)) return "US";
  return "UNKNOWN";
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function strategyTemplate(symbol: string, market = detectMarket(symbol), name = `${symbol} strategy`) {
  return formatJson({
    symbol,
    market,
    name,
    enabledIndicators: ["pe_ratio"],
    decisionPolicy: {
      overboughtScore: 85,
      buyScore: 70,
      holdScore: 45,
      sellScore: 25,
      oversoldScore: 15,
    },
  });
}

function indicatorTemplate(symbol: string, indicatorId = "pe_ratio") {
  return formatJson({
    symbol,
    indicatorId,
    label: "市盈率",
    calculator: "pe_ratio",
    weight: 20,
    params: {},
    scoring: [
      { when: "<= 15", score: 90, reason: "市盈率较低，估值偏便宜" },
      { when: "<= 25", score: 70, reason: "市盈率处于可接受范围" },
      { when: "<= 35", score: 45, reason: "市盈率偏高，需要谨慎" },
      { when: "> 35", score: 20, reason: "市盈率较高，估值压力较大" },
    ],
  });
}

function createStock(symbol: string, name?: string): StockFolder {
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
        id: `${normalized}:indicator:pe_ratio`,
        name: "indicators/pe_ratio.json",
        kind: "indicator",
        content: indicatorTemplate(normalized),
        updatedAt: now(),
      },
    ],
  };
}

const seedLibrary: StockFolder[] = [
  createStock("JNJ", "Johnson & Johnson"),
  createStock("7203", "Toyota Motor"),
];

function loadLibrary() {
  if (typeof window === "undefined") return seedLibrary;
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return seedLibrary;

  try {
    return JSON.parse(stored) as StockFolder[];
  } catch {
    window.localStorage.removeItem(storageKey);
    return seedLibrary;
  }
}

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
  if (score >= (policy.overboughtScore ?? 85)) return "超买";
  if (score >= (policy.buyScore ?? 70)) return "买入";
  if (score >= (policy.holdScore ?? 45)) return "持有";
  if (score >= (policy.sellScore ?? 25)) return "卖出";
  return "超卖";
}

function evaluateStock(stock: StockFolder, snapshot?: MarketSnapshot) {
  const strategyFile = stock.files.find((file) => file.kind === "strategy");
  const strategy = strategyFile ? parseJson<StrategyConfig>(strategyFile.content) : null;
  const indicators = stock.files
    .filter((file) => file.kind === "indicator")
    .map((file) => parseJson<IndicatorConfig>(file.content))
    .filter((indicator): indicator is IndicatorConfig => Boolean(indicator));

  if (!snapshot || indicators.length === 0) {
    return { score: 50, decision: "持有" as Decision, reason: "等待行情或指标配置。" };
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
        ? `${indicator.label ?? indicator.indicatorId}: 当前行情缺少 ${indicator.calculator}，按中性处理`
        : `${indicator.label ?? indicator.indicatorId}: ${value} / ${matchedRule?.reason ?? "未命中规则，按中性处理"}`,
    );
  }

  const score = totalWeight ? Math.round(weightedScore / totalWeight) : 50;
  return {
    score,
    decision: decisionFromScore(score, strategy),
    reason: reasons[0] ?? "无指标说明。",
  };
}

export default function StockWorkbench() {
  const [library, setLibrary] = useState<StockFolder[]>(loadLibrary);
  const [selectedSymbol, setSelectedSymbol] = useState(library[0]?.symbol ?? "");
  const [selectedFileId, setSelectedFileId] = useState(library[0]?.files[0]?.id ?? "");
  const [draft, setDraft] = useState(library[0]?.files[0]?.content ?? "");
  const [newSymbol, setNewSymbol] = useState("");
  const [message, setMessage] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("manage");
  const [snapshots, setSnapshots] = useState<Record<string, MarketSnapshot>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

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
        snapshot: snapshots[stock.symbol],
        evaluation: evaluateStock(stock, snapshots[stock.symbol]),
      })),
    [library, snapshots],
  );

  function persist(next: StockFolder[]) {
    setLibrary(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
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
          if (!response.ok) throw new Error(`Failed to load ${stock.symbol}`);
          return [stock.symbol, (await response.json()) as MarketSnapshot] as const;
        }),
      );
      setSnapshots(Object.fromEntries(entries));
      setMessage("股票信息已刷新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "刷新失败。");
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
      setMessage("请输入股票代码。");
      return;
    }

    if (library.some((stock) => stock.symbol === normalized || stock.symbol.replace(".T", "") === normalized)) {
      setMessage("这个股票已经存在。");
      return;
    }

    const stock = createStock(normalized);
    persist([stock, ...library]);
    setNewSymbol("");
    setSelectedSymbol(stock.symbol);
    setSelectedFileId(stock.files[0].id);
    setDraft(stock.files[0].content);
    setMessage("已用模板新增股票文件夹。");
    setViewMode("manage");
  }

  function addIndicator() {
    if (!selectedStock) return;
    const existingCount = selectedStock.files.filter((file) => file.kind === "indicator").length;
    const indicatorId = existingCount === 0 ? "pe_ratio" : `custom_indicator_${existingCount + 1}`;
    const file: JsonFile = {
      id: `${selectedStock.symbol}:indicator:${indicatorId}:${Date.now()}`,
      name: `indicators/${indicatorId}.json`,
      kind: "indicator",
      content: indicatorTemplate(selectedStock.symbol, indicatorId),
      updatedAt: now(),
    };

    persist(
      library.map((stock) =>
        stock.symbol === selectedStock.symbol ? { ...stock, files: [...stock.files, file] } : stock,
      ),
    );
    setSelectedFileId(file.id);
    setDraft(file.content);
    setMessage("已新增指标 JSON 模板。");
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

    persist(
      library.map((stock) =>
        stock.symbol === selectedStock.symbol ? { ...stock, files: [file, ...stock.files] } : stock,
      ),
    );
    setSelectedFileId(file.id);
    setDraft(file.content);
    setMessage("已新增 strategy.json 模板。");
  }

  function saveFile() {
    if (!selectedStock || !selectedFile) return;
    if (jsonError) {
      setMessage(`JSON 还不能保存：${jsonError}`);
      return;
    }

    const parsed = JSON.parse(draft) as { indicatorId?: string };
    const nextName =
      selectedFile.kind === "indicator" && parsed.indicatorId
        ? `indicators/${parsed.indicatorId}.json`
        : selectedFile.name;

    persist(
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
    );
    setMessage("已保存 JSON。");
  }

  function formatDraftJson() {
    const parsed = parseJson<unknown>(draft);
    if (parsed === null) {
      setMessage(`无法格式化：${jsonError}`);
      return;
    }
    setDraft(formatJson(parsed));
    setMessage("JSON 已自动格式化。");
  }

  function deleteFile() {
    if (!selectedStock || !selectedFile) return;
    const nextFiles = selectedStock.files.filter((file) => file.id !== selectedFile.id);
    persist(
      library.map((stock) =>
        stock.symbol === selectedStock.symbol ? { ...stock, files: nextFiles } : stock,
      ),
    );
    setSelectedFileId(nextFiles[0]?.id ?? "");
    setDraft(nextFiles[0]?.content ?? "");
    setMessage("已删除 JSON 文件。");
  }

  function deleteStock(symbol: string) {
    const next = library.filter((stock) => stock.symbol !== symbol);
    persist(next);
    setSelectedSymbol(next[0]?.symbol ?? "");
    setSelectedFileId(next[0]?.files[0]?.id ?? "");
    setDraft(next[0]?.files[0]?.content ?? "");
    setMessage("已删除股票文件夹。");
  }

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div>
          <p className={styles.kicker}>Silly Stock</p>
          <h1>{viewMode === "manage" ? "股票策略 JSON 文件库" : "股票信息与购买建议一览"}</h1>
        </div>
        <div className={styles.headerTools}>
          <div className={styles.viewTabs}>
            <button className={viewMode === "manage" ? styles.activeTab : ""} onClick={() => setViewMode("manage")}>
              管理 JSON
            </button>
            <button className={viewMode === "dashboard" ? styles.activeTab : ""} onClick={openDashboard}>
              股票一览
            </button>
          </div>
          <form className={styles.symbolForm} onSubmit={addStock}>
            <label htmlFor="new-symbol">新增股票</label>
            <div>
              <input
                id="new-symbol"
                value={newSymbol}
                onChange={(event) => setNewSymbol(event.target.value.toUpperCase())}
                placeholder="JNJ / 7203"
                spellCheck={false}
              />
              <button>新增模板</button>
            </div>
          </form>
        </div>
      </section>

      {viewMode === "manage" ? (
        <section className={styles.libraryShell}>
          <aside className={styles.stockListPanel}>
            <div className={styles.panelHead}>
              <div>
                <p className={styles.kicker}>Stocks</p>
                <h2>股票一览</h2>
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
                  <button onClick={addStrategyIfMissing}>+ strategy</button>
                  <button onClick={addIndicator}>+ indicator</button>
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
                <button className={styles.dangerButton} onClick={() => deleteStock(selectedStock.symbol)}>
                  删除股票文件夹
                </button>
              </>
            ) : (
              <div className={styles.emptyList}>先新增一个股票。</div>
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
                      <p className={styles.success}>JSON 格式有效</p>
                    )}
                    {message ? <p className={styles.statusMessage}>{message}</p> : null}
                  </div>
                  <div className={styles.editorActions}>
                    <button onClick={formatDraftJson}>格式化 JSON</button>
                    <button onClick={() => setDraft(selectedFile.content)}>还原</button>
                    <button onClick={deleteFile}>删除 JSON</button>
                    <button disabled={Boolean(jsonError)} onClick={saveFile}>
                      保存
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.empty}>选择一个 JSON 文件，或新增股票模板。</div>
            )}
          </section>
        </section>
      ) : (
        <section className={styles.dashboardPanel}>
          <div className={styles.panelHead}>
            <div>
              <p className={styles.kicker}>Dashboard</p>
              <h2>股票当前信息与策略结论</h2>
            </div>
            <button className={styles.refreshButton} disabled={isRefreshing} onClick={() => void refreshSnapshots()}>
              {isRefreshing ? "刷新中" : "刷新行情"}
            </button>
          </div>
          {message ? <p className={styles.statusMessage}>{message}</p> : null}
          <div className={styles.dashboardGrid}>
            {dashboardRows.map(({ stock, snapshot, evaluation }) => (
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
                    <span>Price</span>
                    <strong>{snapshot ? `${snapshot.currency} ${snapshot.price.toFixed(2)}` : "--"}</strong>
                  </div>
                  <div>
                    <span>Change</span>
                    <strong className={(snapshot?.changePercent ?? 0) >= 0 ? styles.positive : styles.negative}>
                      {snapshot ? `${snapshot.changePercent.toFixed(2)}%` : "--"}
                    </strong>
                  </div>
                  <div>
                    <span>Score</span>
                    <strong>{evaluation.score}</strong>
                  </div>
                </div>
                <p>{evaluation.reason}</p>
                <button onClick={() => selectStock(stock.symbol)}>打开 JSON 文件夹</button>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

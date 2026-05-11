"use client";

import { FormEvent, useState } from "react";
import styles from "@/app/page.module.css";
import { defaultRuleDocument } from "@/lib/rules/default-document";
import { DocumentAnalysis } from "@/lib/rules/types";

type RegisteredStock = {
  symbol: string;
  rulesDocument: string;
  analysis: DocumentAnalysis;
  savedAt: string;
};

const storageKey = "silly-stock.registered-stocks.v1";

function loadRegisteredStocks() {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = window.localStorage.getItem(storageKey);

  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as RegisteredStock[];
  } catch {
    window.localStorage.removeItem(storageKey);
    return [];
  }
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function StockWorkbench() {
  const [symbol, setSymbol] = useState("AAPL");
  const [rulesDocument, setRulesDocument] = useState(defaultRuleDocument);
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [registeredStocks, setRegisteredStocks] =
    useState<RegisteredStock[]>(loadRegisteredStocks);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  function saveRegisteredStock(stock: RegisteredStock) {
    setRegisteredStocks((current) => {
      const next = [
        stock,
        ...current.filter((item) => item.symbol !== stock.symbol),
      ].slice(0, 30);
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  async function runAnalysis(nextSymbol: string, nextRulesDocument: string) {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: nextSymbol, rulesDocument: nextRulesDocument }),
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(errorBody?.error ?? "Analysis request failed.");
    }

    return (await response.json()) as DocumentAnalysis;
  }

  async function analyze(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const normalized = symbol.trim().toUpperCase();

    if (!normalized) {
      setError("Enter a stock symbol first.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await runAnalysis(normalized, rulesDocument);
      setSymbol(normalized);
      setAnalysis(result);
      saveRegisteredStock({
        symbol: result.snapshot.symbol,
        rulesDocument,
        analysis: result,
        savedAt: new Date().toISOString(),
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unknown error.");
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshRegisteredStock(stock: RegisteredStock) {
    setIsLoading(true);
    setError("");

    try {
      const result = await runAnalysis(stock.symbol, stock.rulesDocument);
      setSymbol(stock.symbol);
      setRulesDocument(stock.rulesDocument);
      setAnalysis(result);
      saveRegisteredStock({
        symbol: result.snapshot.symbol,
        rulesDocument: stock.rulesDocument,
        analysis: result,
        savedAt: new Date().toISOString(),
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unknown error.");
    } finally {
      setIsLoading(false);
    }
  }

  function loadRegisteredStock(stock: RegisteredStock) {
    setSymbol(stock.symbol);
    setRulesDocument(stock.rulesDocument);
    setAnalysis(stock.analysis);
    setError("");
  }

  function removeRegisteredStock(symbolToRemove: string) {
    setRegisteredStocks((current) => {
      const next = current.filter((stock) => stock.symbol !== symbolToRemove);
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  const matchedCount = analysis?.matches.filter((match) => match.passed).length ?? 0;

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div>
          <p className={styles.kicker}>Silly Stock</p>
          <h1>Match a stock against your JSON rules.</h1>
        </div>
        <form className={styles.symbolForm} onSubmit={analyze}>
          <label htmlFor="symbol">Stock symbol</label>
          <div>
            <input
              id="symbol"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value.toUpperCase())}
              placeholder="AAPL"
              spellCheck={false}
            />
            <button disabled={isLoading}>{isLoading ? "Checking" : "Check & save"}</button>
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
        </form>
      </section>

      <section className={styles.workspace}>
        <article className={styles.editorPanel}>
          <div className={styles.panelHead}>
            <div>
              <p className={styles.kicker}>Rules</p>
              <h2>JSON only</h2>
            </div>
            <span>{analysis?.rules.length ?? 0} parsed</span>
          </div>
          <textarea
            aria-label="Rule document"
            value={rulesDocument}
            onChange={(event) => setRulesDocument(event.target.value)}
            spellCheck={false}
          />
        </article>

        <article className={styles.resultPanel}>
          <div className={styles.panelHead}>
            <div>
              <p className={styles.kicker}>Result</p>
              <h2>{analysis ? analysis.snapshot.name : "No query yet"}</h2>
            </div>
            <span>
              {analysis ? `${matchedCount}/${analysis.matches.length} matched` : "Waiting"}
            </span>
          </div>

          {analysis ? (
            <>
              <div className={styles.snapshot}>
                <div>
                  <span>Symbol</span>
                  <strong>{analysis.snapshot.symbol}</strong>
                </div>
                <div>
                  <span>Market</span>
                  <strong>{analysis.snapshot.market}</strong>
                </div>
                <div>
                  <span>Latest price</span>
                  <strong>
                    {analysis.snapshot.currency} {analysis.snapshot.price.toFixed(2)}
                  </strong>
                </div>
                <div>
                  <span>Change from open</span>
                  <strong
                    className={
                      analysis.snapshot.changePercent >= 0 ? styles.positive : styles.negative
                    }
                  >
                    {analysis.snapshot.changePercent.toFixed(2)}%
                  </strong>
                </div>
                <div>
                  <span>Volume</span>
                  <strong>{analysis.snapshot.volume.toLocaleString()}</strong>
                </div>
              </div>

              <div className={styles.conclusion}>
                <h3>Conclusion</h3>
                <p>{analysis.conclusion}</p>
              </div>

              <div className={styles.matchList}>
                {analysis.matches.map((match) => (
                  <div
                    className={match.passed ? styles.matchItemPass : styles.matchItemFail}
                    key={match.rule.id}
                  >
                    <div>
                      <strong>{match.passed ? "Matched" : "Not matched"}</strong>
                      <span>
                        {String(match.rule.field)} {match.rule.operator}{" "}
                        {String(match.rule.value)}
                      </span>
                    </div>
                    <p>{match.message}</p>
                    <small>Actual: {String(match.actualValue)}</small>
                  </div>
                ))}
              </div>

              <footer className={styles.footnote}>
                <span>Source: {analysis.snapshot.source}</span>
                <span>Updated: {formatDate(analysis.snapshot.updatedAt)}</span>
                {analysis.warnings.map((warning) => (
                  <strong key={warning}>{warning}</strong>
                ))}
              </footer>
            </>
          ) : (
            <div className={styles.empty}>
              Write JSON rules on the left, enter a US or Japan stock symbol, then check
              the latest available snapshot against your document.
            </div>
          )}
        </article>
      </section>

      <section className={styles.registeredPanel}>
        <div className={styles.panelHead}>
          <div>
            <p className={styles.kicker}>Registered</p>
            <h2>Stocks with saved rules</h2>
          </div>
          <span>{registeredStocks.length} saved</span>
        </div>

        {registeredStocks.length ? (
          <div className={styles.stockTable}>
            <div className={styles.stockTableHead}>
              <span>Symbol</span>
              <span>Market</span>
              <span>Price</span>
              <span>Rule result</span>
              <span>Conclusion</span>
              <span>Actions</span>
            </div>
            {registeredStocks.map((stock) => {
              const stockMatchedCount = stock.analysis.matches.filter((match) => match.passed).length;

              return (
                <div className={styles.stockRow} key={stock.symbol}>
                  <div>
                    <strong>{stock.analysis.snapshot.symbol}</strong>
                    <small>{stock.analysis.snapshot.name}</small>
                  </div>
                  <span>{stock.analysis.snapshot.market}</span>
                  <span>
                    {stock.analysis.snapshot.currency} {stock.analysis.snapshot.price.toFixed(2)}
                    <small
                      className={
                        stock.analysis.snapshot.changePercent >= 0
                          ? styles.positive
                          : styles.negative
                      }
                    >
                      {stock.analysis.snapshot.changePercent.toFixed(2)}%
                    </small>
                  </span>
                  <span>
                    {stockMatchedCount}/{stock.analysis.matches.length} matched
                  </span>
                  <p>{stock.analysis.conclusion}</p>
                  <div className={styles.rowActions}>
                    <button onClick={() => loadRegisteredStock(stock)}>Load</button>
                    <button disabled={isLoading} onClick={() => void refreshRegisteredStock(stock)}>
                      Refresh
                    </button>
                    <button onClick={() => removeRegisteredStock(stock.symbol)}>Remove</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyList}>
            Stocks appear here after you run Check & save with a valid JSON rule document.
          </div>
        )}
      </section>
    </main>
  );
}

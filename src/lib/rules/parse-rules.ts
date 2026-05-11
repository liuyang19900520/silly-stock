import { MatchRule, MarketSnapshot, RuleOperator } from "./types";

const supportedFields = new Set<keyof MarketSnapshot>([
  "symbol",
  "market",
  "name",
  "price",
  "open",
  "high",
  "low",
  "volume",
  "changePercent",
  "currency",
  "source",
  "updatedAt",
]);

const supportedOperators = new Set<RuleOperator>([
  ">",
  ">=",
  "<",
  "<=",
  "=",
  "!=",
  "contains",
]);

type JsonRule = {
  field?: string;
  operator?: string;
  value?: string | number;
  conclusion?: string;
};

function normalizeRule(rule: JsonRule, index: number): MatchRule | null {
  if (!rule.field || !rule.operator || rule.value === undefined || !rule.conclusion) {
    return null;
  }

  if (!supportedFields.has(rule.field as keyof MarketSnapshot)) {
    return null;
  }

  if (!supportedOperators.has(rule.operator as RuleOperator)) {
    return null;
  }

  return {
    id: `rule-${index + 1}`,
    field: rule.field as keyof MarketSnapshot,
    operator: rule.operator as RuleOperator,
    value: rule.value,
    conclusion: rule.conclusion,
  };
}

export function parseRules(document: string): MatchRule[] {
  const trimmed = document.trim();

  if (!trimmed) {
    return [];
  }

  const parsed = JSON.parse(document) as { rules?: JsonRule[] } | JsonRule[];
  const rules = Array.isArray(parsed) ? parsed : parsed.rules;

  if (!Array.isArray(rules)) {
    throw new Error("JSON must be an array of rules or an object with a rules array.");
  }

  return rules
    .map((rule, index) => normalizeRule(rule, index))
    .filter((rule): rule is MatchRule => Boolean(rule));
}

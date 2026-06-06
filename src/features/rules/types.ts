import { MarketSnapshot } from "@/features/market-data/types";

export type RuleOperator = ">" | ">=" | "<" | "<=" | "=" | "!=" | "contains";

export type MatchRule = {
  id: string;
  field: keyof MarketSnapshot;
  operator: RuleOperator;
  value: string | number;
  conclusion: string;
};

export type RuleMatch = {
  rule: MatchRule;
  actualValue: string | number;
  passed: boolean;
  message: string;
};

export type DocumentAnalysis = {
  symbol: string;
  snapshot: MarketSnapshot;
  rules: MatchRule[];
  matches: RuleMatch[];
  conclusion: string;
  warnings: string[];
};

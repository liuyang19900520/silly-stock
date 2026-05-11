import { MatchRule, MarketSnapshot, RuleMatch } from "./types";

function compare(actual: string | number, rule: MatchRule) {
  if (rule.operator === "contains") {
    return String(actual).toLowerCase().includes(String(rule.value).toLowerCase());
  }

  if (typeof actual === "number" && typeof rule.value === "number") {
    if (rule.operator === ">") return actual > rule.value;
    if (rule.operator === ">=") return actual >= rule.value;
    if (rule.operator === "<") return actual < rule.value;
    if (rule.operator === "<=") return actual <= rule.value;
    if (rule.operator === "=") return actual === rule.value;
    if (rule.operator === "!=") return actual !== rule.value;
  }

  if (rule.operator === "=") return String(actual) === String(rule.value);
  if (rule.operator === "!=") return String(actual) !== String(rule.value);

  return false;
}

export function matchRules(snapshot: MarketSnapshot, rules: MatchRule[]): RuleMatch[] {
  return rules.map((rule) => {
    const actualValue = snapshot[rule.field] as string | number;
    const passed = compare(actualValue, rule);

    return {
      rule,
      actualValue,
      passed,
      message: passed
        ? rule.conclusion
        : `${String(rule.field)} is ${String(actualValue)}, so this rule did not match.`,
    };
  });
}

export function summarizeMatches(matches: RuleMatch[]) {
  if (!matches.length) {
    return "No valid rules were found in the document.";
  }

  const passed = matches.filter((match) => match.passed);

  if (passed.length === 0) {
    return "None of your rules matched the latest snapshot.";
  }

  return `${passed.length} of ${matches.length} rules matched. Main conclusion: ${passed
    .map((match) => match.rule.conclusion)
    .join(" / ")}`;
}

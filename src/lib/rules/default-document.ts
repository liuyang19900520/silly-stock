export const defaultRuleDocument = `{
  "rules": [
    {
      "field": "price",
      "operator": "<",
      "value": 200,
      "conclusion": "Price is still inside my preferred range"
    },
    {
      "field": "changePercent",
      "operator": ">",
      "value": 0,
      "conclusion": "Today has positive price action"
    },
    {
      "field": "market",
      "operator": "=",
      "value": "US",
      "conclusion": "This matched my US stock rule set"
    }
  ]
}`;

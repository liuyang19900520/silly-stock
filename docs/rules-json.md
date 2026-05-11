# JSON Rules

The app accepts JSON only. The top-level shape can be either an array of rules or an object with a `rules` array.

```json
{
  "rules": [
    {
      "field": "market",
      "operator": "=",
      "value": "US",
      "conclusion": "This matched my US stock rule set"
    },
    {
      "field": "price",
      "operator": "<",
      "value": 200,
      "conclusion": "Price is inside my preferred range"
    }
  ]
}
```

## Supported Fields

- `symbol`
- `market`
- `name`
- `price`
- `open`
- `high`
- `low`
- `volume`
- `changePercent`
- `currency`
- `source`
- `updatedAt`

## Supported Operators

- `>`
- `>=`
- `<`
- `<=`
- `=`
- `!=`
- `contains`

## Market Detection

The current detector supports:

- US stocks: `AAPL`, `MSFT`, `NVDA`
- Japanese stocks: `7203`, `7203.T`, `7203.JP`

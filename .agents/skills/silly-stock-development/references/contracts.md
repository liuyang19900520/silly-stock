# Project Contracts

## Decisions

Every evaluated stock resolves to exactly one of:

```text
Overbought
Buy
Hold
Sell
Oversold
```

## Strategy storage

```text
users/{userId}/stocks/{symbol}/meta.json
users/{userId}/stocks/{symbol}/strategy.json
users/{userId}/stocks/{symbol}/indicators/{indicatorId}.json
```

Strategy files must contain valid JSON. Symbols and filenames must pass
`src/features/strategy-library/validation.ts`.

## Market snapshot

The snapshot contract is defined in `src/features/market-data/types.ts`. It includes current price,
100-day moving average, 200-day moving average, source, and update time.

## Verification

```bash
npm run verify
npm run smoke:production
npm run smoke:production:crud
```

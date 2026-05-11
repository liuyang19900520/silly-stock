# Silly Stock

Silly Stock is a small AI-native stock research MVP. The current version keeps the product intentionally simple:

- Enter a stock symbol.
- Paste a JSON rule document.
- Fetch the latest available market snapshot.
- Match the snapshot against your rules.
- Save checked stocks into a local registered list.

It supports automatic market detection for common US and Japanese stock symbols.

> This tool is research support only. It does not provide buy, sell, or hold advice.

## Features

- JSON-only rule input
- US and Japan market detection
- Delayed quote lookup through Stooq CSV data
- Mock fallback data when the market request fails
- Local registered-stock list stored in browser `localStorage`
- Rule match summary and per-rule result display
- GitHub Actions CI for lint and production build

## Tech Stack

- Next.js App Router
- React
- TypeScript
- CSS Modules
- GitHub Actions

## Getting Started

Install dependencies:

```bash
npm ci
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run start
```

## Rules

Rules must be JSON. See [docs/rules-json.md](docs/rules-json.md).

Example:

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

## Deployment

See [docs/deployment.md](docs/deployment.md).

Recommended low-cost default: Vercel.

AWS Amplify is also supported and is a good option if this project will later integrate deeply with AWS services.

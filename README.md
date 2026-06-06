# Silly Stock

Silly Stock is a small AI-native stock research tool. It fetches current market data, evaluates
user-managed JSON strategies, and presents a deterministic score and decision.

Production: [https://silly-stock.vercel.app](https://silly-stock.vercel.app)

> Research support only. The application does not provide personalized investment advice.

## Current Features

- US and Japanese stock-symbol detection
- Current quote plus 100-day and 200-day moving averages
- S3-backed strategy JSON create, read, update, and delete
- Per-stock strategy and indicator folders
- Deterministic weighted scoring with explainable results
- Decisions: `Overbought`, `Buy`, `Hold`, `Sell`, `Oversold`
- GitHub Actions verification and automatic Vercel deployment

## Architecture

```text
Browser -> Next.js API -> feature logic -> S3 / market-data providers
```

Business logic lives in `src/features`, external-service code in `src/infrastructure`, and API
routes remain thin. See [docs/architecture.md](docs/architecture.md).

## Local Development

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Local AWS access uses the standard AWS SDK credential chain. Do not place administrator credentials
in `.env.local`.

## Commands

```bash
npm run dev
npm run verify
npm run smoke:production
npm run smoke:production:crud
```

## Documentation

- [Architecture](docs/architecture.md)
- [AI development workflow](docs/ai-development.md)
- [Deployment](docs/deployment.md)
- [JSON rules](docs/rules-json.md)

Project-specific agent instructions are in [AGENTS.md](AGENTS.md) and
[.agents/skills/silly-stock-development/SKILL.md](.agents/skills/silly-stock-development/SKILL.md).

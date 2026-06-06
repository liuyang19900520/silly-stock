# Architecture

Silly Stock is a small Next.js application with feature-first business modules and explicit
infrastructure adapters.

```text
src/
├── app/
│   ├── api/                       HTTP routes only
│   └── page.tsx                   Application entry
├── components/                    Client UI
├── config/                        Server environment parsing
├── features/
│   ├── market-data/               Market snapshot contract
│   ├── rules/                     Generic JSON rule matching
│   └── strategy-library/          Strategy templates, validation, scoring
└── infrastructure/
    └── aws/                       S3 repository implementation
```

## Data flow

```text
Browser
  -> Next.js API route
  -> feature validation or scoring
  -> infrastructure adapter
  -> S3 / Yahoo Finance
```

## Ownership

- `features/market-data`: defines the snapshot shape. Provider implementations live under
  `server/` or `infrastructure`.
- `features/rules`: parses and evaluates generic rule documents.
- `features/strategy-library`: owns stock folders, JSON templates, validation, and scoring.
- `infrastructure/aws`: owns AWS SDK calls and S3 object layout.
- `components`: owns interaction state and rendering, but not scoring or persistence logic.
- `app/api`: owns HTTP status codes and response shapes, but not business rules.

## S3 layout

```text
users/{userId}/stocks/{symbol}/meta.json
users/{userId}/stocks/{symbol}/strategy.json
users/{userId}/stocks/{symbol}/indicators/{indicatorId}.json
```

Writes upload the desired state before deleting stale objects. This prevents a failed upload from
first erasing the existing strategy library.

## Deployment

- GitHub `main` triggers the Vercel production deployment.
- GitHub Actions runs `npm run verify`.
- Vercel server functions access S3 with a dedicated least-privilege IAM user.
- Browser code never receives AWS credentials.
- Next.js Proxy applies HTTP Basic Authentication to the production UI and API.

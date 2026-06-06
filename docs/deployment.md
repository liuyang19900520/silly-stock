# Deployment

Production: [https://silly-stock.vercel.app](https://silly-stock.vercel.app)

Vercel is the deployment platform and S3 stores private strategy JSON. A push to GitHub `main`
triggers production deployment.

## Required Vercel variables

```text
AWS_REGION=ap-northeast-1
STRATEGY_LIBRARY_BUCKET=silly-stock-json-324971275476-ap-northeast-1
STRATEGY_LIBRARY_USER_ID=default
AWS_ACCESS_KEY_ID=<dedicated IAM access key>
AWS_SECRET_ACCESS_KEY=<dedicated IAM secret>
APP_BASIC_AUTH_USER=<private application user>
APP_BASIC_AUTH_PASSWORD=<strong private password>
```

Use a dedicated IAM identity restricted to:

```text
s3://silly-stock-json-324971275476-ap-northeast-1/users/default/stocks/*
```

Do not use an AWS administrator key and do not prefix server-only variables with `NEXT_PUBLIC_`.
Basic authentication protects both the UI and API from unauthenticated strategy changes.

## GitHub Actions

This repository includes `.github/workflows/ci.yml`.

It runs on every pull request and every push to `main`:

```bash
npm run verify
```

After a production deployment:

```bash
npm run smoke:production
APP_BASIC_AUTH_USER=... APP_BASIC_AUTH_PASSWORD=... npm run smoke:production:crud
```

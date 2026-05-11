# Deployment

## Recommended low-cost path

For this MVP, Vercel is the best default:

- Wide adoption for Next.js projects
- Generous free tier for small apps
- Automatic preview deployments for pull requests
- Minimal configuration

Connect the GitHub repository in Vercel, keep the default Next.js settings, and use:

- Build command: `npm run build`
- Install command: `npm ci`
- Output: managed by Vercel

## AWS Amplify

Amplify also works well for GitHub-connected Next.js apps. It is a good choice if the project will later use AWS services such as Cognito, DynamoDB, Lambda, or EventBridge.

For this current app, Amplify is a little heavier than needed. Use it if AWS integration matters more than minimal setup.

## GitHub Actions

This repository includes `.github/workflows/ci.yml`.

It runs on every pull request and every push to `main`:

```bash
npm ci
npm run lint
npm run typecheck
npm run build
```

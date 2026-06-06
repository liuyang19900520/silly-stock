<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Silly Stock Engineering Contract

Read `docs/architecture.md` before changing module boundaries, persistence, scoring, or market-data behavior.

## Required workflow

1. Inspect the relevant feature and its API route before editing.
2. Keep business logic in `src/features`; keep AWS and provider code in `src/infrastructure`.
3. Keep `src/app/api` thin: parse HTTP input, call a feature/infrastructure function, map errors.
4. Validate all data crossing HTTP or persistence boundaries at runtime.
5. Never expose AWS credentials or import server infrastructure into client components.
6. Preserve production authentication coverage for both the UI and API.
7. Run `npm run verify` before committing.
8. For deployment or persistence changes, run `npm run smoke:production:crud` after production is ready.
9. Update `README.md` or `docs/` when behavior, environment variables, JSON contracts, or operations change.

## Product invariants

- Strategy JSON is the source of truth and is stored privately in S3.
- Market data is fetched on demand and is not persisted as authoritative data.
- Decisions remain one of `Overbought`, `Buy`, `Hold`, `Sell`, or `Oversold`.
- Scores must be deterministic and explainable from JSON rules.
- UI content remains English.
- The product is research support, not personalized investment advice.

## Change discipline

- Prefer small feature modules over generic utility folders.
- Do not add a new cloud service when S3 and Vercel cover the requirement.
- Do not silently fall back to mock market data.
- Preserve user strategy JSON during migrations and make storage writes recoverable.
- Use least-privilege cloud credentials and never commit secrets.

For repeatable project work, use `.agents/skills/silly-stock-development/SKILL.md`.

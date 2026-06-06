---
name: silly-stock-development
description: Develop, refactor, debug, verify, or deploy the Silly Stock Next.js application. Use for changes involving stock market data, JSON strategies, scoring decisions, S3 persistence, API routes, Vercel deployment, GitHub Actions, or project architecture.
---

# Silly Stock Development

Follow the project architecture and verify changes from local code through production.

## Workflow

1. Read `AGENTS.md` and `docs/architecture.md`.
2. Locate the owning module under `src/features`.
3. Keep provider and AWS details under `src/infrastructure`.
4. Add runtime validation for changed HTTP or persistence inputs.
5. Preserve deterministic scoring and the fixed decision vocabulary.
6. Run `scripts/verify-project.sh`.
7. For cloud changes, inspect `docs/deployment.md`, deploy through GitHub, then run the production
   smoke test with `--crud`.
8. Update project rules or documentation when a reusable constraint is discovered.

## Guardrails

- Do not place AWS SDK calls in client components.
- Do not expose secrets through `NEXT_PUBLIC_*`.
- Do not remove production authentication from either pages or API routes.
- Do not use mock market data as a silent production fallback.
- Do not delete persisted strategy objects before replacement objects are safely uploaded.
- Do not change JSON filenames or scoring contracts without a migration path.
- Keep UI text in English.

## References

- Read `references/contracts.md` when changing JSON, scoring, or S3 behavior.
- Run `scripts/verify-project.sh` before committing.

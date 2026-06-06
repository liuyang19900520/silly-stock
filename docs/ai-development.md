# AI Development

The repository is designed so coding agents can improve it without rediscovering core decisions.

## Sources of truth

1. `AGENTS.md`: non-negotiable engineering and product rules.
2. `docs/architecture.md`: module ownership and data flow.
3. `.agents/skills/silly-stock-development/SKILL.md`: repeatable implementation workflow.
4. Feature types and validators: executable data contracts.
5. `npm run verify`: local quality gate.
6. `npm run smoke:production:crud`: production integration gate.

## Iteration loop

For each change:

1. Reproduce or inspect the current behavior.
2. Identify the owning feature.
3. Change the smallest coherent module.
4. Add or strengthen boundary validation when the contract changes.
5. Run local verification.
6. Deploy through GitHub.
7. Run the production smoke test.
8. Update architecture or operational documentation when a new invariant is learned.

Agents should improve these instructions when a repeated failure reveals a missing guardrail. Avoid
recording one-off debugging details; add only reusable constraints or checks.

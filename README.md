# Nebula

**Your AI Financial Decision Engine.**

Today's AI can execute transactions. Nebula decides whether they should happen at all.

Tell Nebula your financial goal, and it returns a transparent, accountable financial decision — a clear recommendation with reasoning, policy compliance, goal feasibility, and a ready-to-execute plan for your AI agent.

## How it works

```
Your goal, in your own words
        │
        ▼
┌─────────────────────────────────────────────┐
│                   Nebula                    │
│                                             │
│  1. Derives financial policies from your    │
│     own words ("I don't want to lose money")│
│  2. Gathers live on-chain data — yields,    │
│     TVL history, liquidity, security scans  │
│  3. Filters every option against your rules │
│  4. Checks whether your goal is realistic   │
└─────────────────────────────────────────────┘
        │
        ▼
A decision your agent can execute
```

Every decision includes:

- **Recommendation** — `proceed` · `proceed_with_caution` · `dont_proceed`, computed deterministically from policy and feasibility checks
- **Reasoning** — why each option was chosen or rejected
- **Policy compliance** — which of your rules were applied, and which were binding
- **Goal feasibility** — whether your target is realistic, and alternatives if it is not
- **Execution plan** — structured steps an authorized agent can run on its own wallet

Nebula never holds your funds and never touches your wallet. It decides; your agent executes.

## Monorepo

| Path              | Description                                                              |
| ----------------- | ------------------------------------------------------------------------ |
| `packages/shared` | Decision contract — types and schemas shared across the stack            |
| `packages/engine` | The decision engine — policy derivation, market data, decision synthesis |
| `apps/api`        | Decision API — serves the engine to AI agents                            |

## Getting started

```bash
pnpm install
pnpm build
pnpm dev
```

Requires Node.js ≥ 22 and pnpm ≥ 10.

## Built on

Nebula is an Agent Service Provider (ASP) on [OKX.AI](https://www.okx.ai), with market data and settlement powered by [OKX Onchain OS](https://web3.okx.com/onchainos) and X Layer.

## License

MIT

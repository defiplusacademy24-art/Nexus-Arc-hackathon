# Nexusu Autonomous Multi-Agent Architecture

AI agents for cooperative banking on **Arc Network** using **Circle Agent Stack**.

> **Setup guide (wallets, env, on-chain roles, smoke tests):**  
> [`docs/AGENT_AND_CIRCLE_WALLET_SETUP.md`](../../../../docs/AGENT_AND_CIRCLE_WALLET_SETUP.md)

## Hard rules

- Agents **never store money**. All funds remain in smart contracts:
  - Cooperative Registry
  - Treasury Vault
  - Loan Pool
  - Rotation Manager
- Each agent has an **independent Circle Agent Wallet** (least privilege).
- No private keys or seed phrases in this process — execution via `CIRCLE_BIN`.
- Fail closed: missing evidence → `governance_review` / human approval.

## Agents

| Agent | Mutates chain? | Role |
|-------|----------------|------|
| Treasury | No | Deposits, balances, allocations, anomaly alerts |
| Contribution | No | Deadlines, reminders, cycle completion |
| Rotation | Yes (`executeRotation`) | Payouts once per cycle |
| Loan | Yes (`approveLoan` / `rejectLoan`) | Risk eval, interest quotes, repayments |
| Savings | No | Allocation recommendations only |
| Governance | Policy | Proposals, votes, loan overrides |
| Fraud | No | Risk alerts low→critical |
| Nexa | No | Member-scoped financial assistant |
| Notification | No | Dashboard / future email+push |

## Layout

```
agents/
  types.ts            Shared domain types
  config.ts           Env + contract addresses
  event-bus.ts        Internal pub/sub
  store.ts            Durable events, tasks, memory, audit (Postgres)
  wallets.ts          Circle Agent Wallet adapter + allowlists
  decision-engine.ts  SpaceXAI structured decisions
  chain-listener.ts   Arc event watchers (viem)
  runtime.ts          Orchestrator (queue drain, rate limits)
  interest.ts         1–6 month loan interest schedule
  rate-limit.ts       Wallet call rate limiter
  abis.ts             Contract ABIs for decode/tools
  base-agent.ts       Independent agent interface
  prompts/            System prompts per agent
  tools/              Tool catalog
  services/           One module per agent
```

## Event bus (examples)

```
Treasury deposit → Treasury Agent → Contribution Agent → Rotation Agent → Notification
Loan repaid      → Loan Agent → Treasury Agent → Savings Agent → Governance
```

## Interest schedule (Loan Pool)

| Months | Rate |
|--------|------|
| 1 | 5% |
| 2 | 6% |
| 3 | 7% |
| 4 | 8% |
| 5 | 9% |
| 6 | 10% |

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agents/health` | Runtime + wallet health |
| GET | `/api/agents` | Catalog, tools, prompts summary |
| GET | `/api/agents/audit` | Decision / tx audit log |
| GET | `/api/agents/events` | Domain event ledger |
| POST | `/api/agents/events` | Inject event (ops/tests) |
| GET | `/api/agents/:name/memory` | Agent memory |
| POST | `/api/agents/nexa/ask` | Nexa assistant (`x-wallet-address`) |
| GET | `/api/agents/loans/quote` | Interest calculator |

## Enable

Long-running worker only (not Vercel serverless):

```bash
export AGENTS_ENABLED=true
export DATABASE_URL=postgresql://...
export CIRCLE_BIN=/usr/local/bin/circle
export XAI_API_KEY=xai-...
export COOPERATIVE_REGISTRY_ADDRESS=0x...
export TREASURY_VAULT_ADDRESS=0x...
export LOAN_POOL_ADDRESS=0x...
export ROTATION_MANAGER_ADDRESS=0x...
# + CIRCLE_AGENT_WALLET_*_ADDRESS for each agent
pnpm --filter @workspace/api-server start
```

See `../.env.example` for the full variable list.

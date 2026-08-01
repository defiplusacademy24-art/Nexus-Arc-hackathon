## Overview

Nexusu is an AI-powered cooperative finance operating system that digitizes traditional savings groups such as Esusu, Ajo, Chama, and Stokvel.

Instead of relying on manual bookkeeping and administrators, Nexusu combines smart contracts, AI agents, and Circle's Agent Stack to automate contributions, treasury management, lending, governance, and rotating payouts.

Funds remain secured on-chain while AI agents monitor activity, make recommendations, and execute approved actions autonomously.

## Objectives

Build a production-ready MVP demonstrating:

- Digital cooperative creation
- Member onboarding
- Cooperative treasury management
- Automated contribution tracking
- Rotating payouts
- AI-assisted lending
- Autonomous treasury agents
- Circle User-Controlled Wallet authentication
- Circle Agent Stack integration
- USDC payments on Arc Testnet

## Core Technologies

**Frontend** — React · TypeScript · Tailwind CSS · Vite

**Backend** — Node.js · Express · TypeScript

**Blockchain** — Arc Testnet · Solidity · Foundry · OpenZeppelin · viem

**Authentication** — Circle User-Controlled Wallets · Email OTP

**Payments** — USDC on Arc

**AI** — Circle Agent Stack · SpaceXAI / OpenAI-compatible SDK

## System Architecture

```architecture
```

Request path:

1. Members use the web app (React)
2. Backend API (Express) handles domain data and Circle UC flows
3. Circle User-Controlled Wallets sign member transactions
4. Arc smart contracts hold and move USDC
5. Circle Agent Stack + autonomous agents observe and act under policy

## Smart Contracts

### Cooperative Registry

Creates cooperatives, manages joins, settings, payout strategy, member order, and metadata (name, organizer, contribution rules, treasury and loan pool addresses).

### Treasury Vault

Receives all cooperative contributions and accounts for:

| Bucket | Share |
| --- | --- |
| Rotation Fund | 60% |
| Loan Pool | 30% |
| Emergency Reserve | 5% |
| Savings Reserve | 5% |

When `lendingPool` is configured, the loan share is forwarded on-chain into the Cooperative Loan Pool on each deposit.

### Loan Pool

Holds loan capital, disburses approved loans, receives repayments, calculates interest, returns principal to the pool, and can forward interest to the treasury. Members apply, edit, or cancel **pending** applications; the organizer or lending agent approves disbursement.

### Rotation Manager

Determines the payout recipient, executes payouts, advances the queue, and stores history.

**Strategies:** Join Order · Random Draw · Organizer Assigned · Governance Vote

## Circle Integration

Members authenticate with **Circle User-Controlled Wallets** and **Email OTP**. No seed phrases. Every member receives a smart wallet.

## Circle Agent Stack

Each AI agent owns an independent Circle Agent Wallet with least-privilege permissions. Agents never custody member funds — capital stays in smart contracts.

- Treasury Agent
- Loan Agent
- Rotation Agent
- Savings Agent
- Governance Agent
- Notification Agent
- Fraud Detection Agent
- Nexa AI Assistant

## AI Agents

### Treasury Agent

Monitors treasury, deposits, allocations, and anomalies. Never moves funds without authorization.

### Contribution Agent

Tracks deadlines and payments, detects misses, notifies members, signals payout readiness.

### Rotation Agent

Reads the schedule, detects completed cycles, executes payouts, advances recipients, notifies members.

### Loan Agent

Evaluates applications, contribution and repayment history, schedules, recommendations, and reputation.

### Savings Agent

Tracks cooperative savings and growth; recommendations only (no automatic investing).

### Governance Agent

Summarizes proposals, tracks votes, executes only approved actions.

### Fraud Detection Agent

Watches for duplicate wallets, abnormal activity, and rapid withdrawals; raises risk alerts.

### Nexa AI Assistant

Member-scoped assistant for treasury health, eligibility, payouts, and contributions — never exposes other members' private data.

## Cooperative Lifecycle

1. **Create** — Organizer sets name, contribution amount/frequency, max members, payout strategy.
2. **Join** — Members sign in with Email OTP + Circle Wallet; receive a payout position.
3. **Contribute** — Members deposit USDC; treasury and analytics update.
4. **Allocate** — Rotation / Loan / Emergency / Savings shares applied (loan share can auto-fund the Loan Pool).
5. **Lend** — Members apply; AI evaluates; organizer/agent disburses from the Loan Pool.
6. **Repay** — Principal returns to the Loan Pool; interest can go to treasury.
7. **Rotate** — When contributions complete, payout advances and history is recorded.

## Loan Rules

### Interest schedule (simple, full term)

| Term | Rate |
| --- | --- |
| 1 month | 5% |
| 2 months | 6% |
| 3 months | 7% |
| 4 months | 8% |
| 5 months | 9% |
| 6 months | 10% |

### Decision inputs

Contribution consistency · repayment history · pool liquidity · reputation · open loans · risk score

### On-chain caps

Default max single loan is **25% of Loan Pool liquidity** (`maxLoanBps = 2500`) at approval time.

## Savings Module

Savings is **not** personal savings — it belongs to the cooperative. Treasury allocates **5%** to Savings Reserve. Yield currently comes from loan interest.

**Future:** external DeFi yield, tokenized treasury assets, member votes on profit use.

## Governance

Members vote on rule changes, emergency spending, treasury allocation, profit distribution, and loan overrides. AI recommends; members decide.

## Dashboards

**Treasury** — Balances, buckets, monthly contributions, health, AI insights.

**Member** — Contributions, payout position, eligibility, credit score, notifications.

**Loans** — Amount, interest, progress, schedule; apply / edit / cancel pending apps.

**Savings** — Allocation, yield, growth, AI recommendations.

## Backend API

| Area | Endpoints |
| --- | --- |
| Health | `GET /api/health` |
| Circle UC | `POST /api/uc/*` |
| Cooperatives | `POST/GET /api/cooperatives` |
| Transactions | `POST/GET /api/transactions` |
| Notifications | `GET /api/notifications` |
| On-chain | `/api/onchain/*` |
| Agents | `/api/agents/*` |

Autonomous agents run on a **long-lived worker** (`AGENTS_ENABLED=true`), not serverless alone.

## Database

Cooperatives, members, transactions, notifications, governance, agent events / tasks / memory / audit.

## Notifications

Contribution reminders · loan approvals & repayments · rotation payouts · governance · treasury & risk alerts (dashboard today; email/push later).

## Security

- No private keys or seed phrases in the app
- Circle User-Controlled Wallets for members
- Circle Agent Wallets for agents (least privilege)
- Validated contract calls and role-based permissions
- OpenZeppelin patterns, rate limits, idempotent agent work

## Production Goals

Responsive UI · dark mode · modular architecture · logging · error handling · env configuration · scalable multi-agent framework

## Success Criteria

Create and join cooperatives with Email OTP · USDC on Arc Testnet · treasury allocations · AI-assisted loans · rotation payouts · agent monitoring · notifications · Circle + Arc end-to-end

## Future Roadmap

Cross-cooperative lending · investment vaults · yield strategies · cross-border coops · DAO governance · mobile app · on-chain reputation · credit passport · multi-currency · institutional cooperative banking

## Vision

Nexusu is building the financial operating system for community finance.

By combining AI agents, programmable money, Circle Agent Stack, and Arc Network, Nexusu transforms traditional savings groups into autonomous, transparent, and intelligent financial institutions that can scale across Africa and emerging markets.

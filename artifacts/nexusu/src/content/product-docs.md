# Nexusu

## The Operating System for Community Finance

| | |
|---|---|
| **Version** | 1.0 |
| **Status** | Arc Hackathon MVP |
| **Network** | Arc Testnet |
| **Stablecoin** | USDC |
| **AI Infrastructure** | Circle Agent Stack |

---

## Overview

Nexusu is an AI-powered cooperative finance operating system that digitizes traditional savings groups such as Esusu, Ajo, Chama, and Stokvel.

Instead of relying on manual bookkeeping and administrators, Nexusu combines smart contracts, AI agents, and Circle's Agent Stack to automate contributions, treasury management, lending, governance, and rotating payouts.

Funds remain secured on-chain while AI agents monitor activity, make recommendations, and execute approved actions autonomously.

---

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

---

## Core Technologies

### Frontend

- React
- TypeScript
- Tailwind CSS
- Vite

### Backend

- Node.js
- Express
- TypeScript

### Blockchain

- Arc Testnet
- Solidity
- Foundry
- OpenZeppelin

### Authentication

- Circle User-Controlled Wallets
- Email OTP

### Payments

- USDC on Arc

### AI

- Circle Agent Stack
- SpaceXAI / OpenAI-compatible SDK

### Blockchain Libraries

- viem

---

## System Architecture

```
Users
  ↓
Frontend
  ↓
Backend API
  ↓
Circle User-Controlled Wallets
  ↓
Arc Smart Contracts
  ↓
Circle Agent Stack
  ↓
Autonomous AI Agents
```

---

## Smart Contracts

### Cooperative Registry

**Responsibilities**

- Create cooperatives
- Join cooperatives
- Store cooperative settings
- Store payout strategy
- Store member order
- Store member metadata

**Stores**

- Cooperative name, description, organizer
- Contribution amount and frequency
- Member list and join position
- Payout strategy
- Treasury address, loan pool address

### Treasury Vault

**Responsibilities**

Receive all cooperative contributions. Automatically account for:

| Bucket | Share |
|--------|-------|
| Rotation Fund | 60% |
| Loan Pool | 30% |
| Emergency Reserve | 5% |
| Savings Reserve | 5% |

When `lendingPool` is configured, the loan share is forwarded on-chain into the Cooperative Loan Pool on each deposit.

**Stores**

- Treasury balances
- Contribution history
- Fund allocations
- Treasury health

### Loan Pool

**Responsibilities**

- Store loan capital
- Disburse approved loans
- Receive repayments
- Calculate interest
- Return principal to loan pool
- Transfer interest to treasury (when profit recipient is set)

Members may apply, edit, or cancel **pending** applications. Organizer (or lending agent) approves disbursement.

### Rotation Manager

**Responsibilities**

- Determine payout recipient
- Read member order
- Execute payouts
- Advance recipient
- Maintain payout history

**Supported payout strategies**

- Join Order
- Random Draw
- Organizer Assigned
- Governance Vote

---

## Circle Integration

Members authenticate using:

- Circle User-Controlled Wallets
- Email OTP

No seed phrases. Every member receives a smart wallet.

---

## Circle Agent Stack

Every AI agent owns an independent Circle Agent Wallet with least-privilege permissions:

- Treasury Agent
- Loan Agent
- Rotation Agent
- Savings Agent
- Governance Agent
- Notification Agent
- Fraud Detection Agent
- Nexa AI Assistant

Agents **never custody member funds**. Capital stays in smart contracts.

---

## AI Agents

### Treasury Agent

Monitor treasury, watch deposits, generate analytics, track allocations, detect anomalies. Never move funds without authorization.

### Contribution Agent

Monitor contribution deadlines, track payments, detect missed contributions, notify members, signal payout readiness.

### Rotation Agent

Read payout schedule, detect completed cycles, execute automatic payouts, advance recipient, notify members.

### Loan Agent

Evaluate applications, review contribution and repayment history, calculate schedules, recommend decisions, monitor repayments, update reputation.

### Savings Agent

Track cooperative savings, monitor treasury growth, generate recommendations (never invest automatically).

### Governance Agent

Summarize proposals, track voting, execute only approved actions, notify members.

### Fraud Detection Agent

Monitor duplicate wallets, abnormal transactions, rapid withdrawals; generate risk alerts.

### Nexa AI Assistant

Financial assistant for members: treasury health, loan eligibility, payout schedules, contribution status — never exposes other members' private data.

---

## Cooperative Lifecycle

1. **Create** — Organizer defines name, contribution amount/frequency, max members, payout strategy.
2. **Join** — Members authenticate with Email OTP + Circle Wallet; receive payout position.
3. **Contribute** — Members deposit USDC; treasury records deposits; AI updates analytics.
4. **Allocate** — Rotation / Loan / Emergency / Savings shares applied (loan share can auto-fund the Loan Pool).
5. **Lend** — Members apply; Loan Agent evaluates; organizer/agent disburses from Loan Pool.
6. **Repay** — Principal returns to Loan Pool; interest to treasury profit recipient.
7. **Rotate** — When contributions complete, Rotation Agent / vault payout advances recipient and history.

---

## Loan Rules

### Interest (simple, full term)

| Term | Rate |
|------|------|
| 1 month | 5% |
| 2 months | 6% |
| 3 months | 7% |
| 4 months | 8% |
| 5 months | 9% |
| 6 months | 10% |

### Decision inputs

- Contribution consistency
- Repayment history
- Treasury / pool liquidity
- Member reputation
- Open loans
- Risk score

### On-chain caps

Default max single loan is **25% of Loan Pool liquidity** (`maxLoanBps = 2500`) at approval time.

---

## Savings Module

Savings is **not** personal savings — it belongs to the cooperative.

Treasury allocates **5%** to Savings Reserve. Yield currently comes from loan interest.

**Future:** external DeFi yield, tokenized treasury assets, member votes on profit use.

---

## Governance

Members vote on rule changes, emergency spending, treasury allocation, profit distribution, and loan overrides. AI generates recommendations; members make final decisions.

---

## Dashboards

### Treasury

Treasury balance, loan pool, emergency reserve, savings reserve, monthly contributions, health, contribution completion, AI insights.

### Member

Contribution history, payout position, next payout, loan eligibility, credit score, contribution streak, notifications.

### Loans

Amount, interest, remaining balance, repayment progress, schedule, risk score; apply / edit / cancel pending applications.

### Savings

Savings balance, allocation, yield, treasury growth, history, AI recommendations.

---

## Backend API

| Area | Examples |
|------|----------|
| Health | `GET /api/health` |
| Circle UC | `POST /api/uc/*` (email OTP + PIN) |
| Cooperatives | `POST/GET /api/cooperatives` |
| Transactions | `POST/GET /api/transactions` |
| Notifications | `GET /api/notifications` |
| On-chain | `/api/onchain/*` |
| Agents | `GET /api/agents/health`, audit, events, Nexa |

Autonomous agents run on a **long-lived worker** (`AGENTS_ENABLED=true`), not serverless alone.

---

## Database

Cooperatives, members, contributions/transactions, loans, notifications, governance, agent events/tasks/memory/audit.

---

## Notifications

Contribution reminders, loan approvals/repayments, rotation payouts, governance voting, treasury and risk alerts — dashboard today; email/push later.

---

## Security

- Never expose private keys or seed phrases
- Circle User-Controlled Wallets for members
- Circle Agent Wallets for agents (least privilege)
- Validate every contract interaction
- Role-based permissions (organizer, lending agent, borrower)
- OpenZeppelin patterns; rate limits; idempotent agent tasks

---

## Production Goals

Responsive UI, dark mode, modular architecture, logging, error handling, env configuration, scalable multi-agent framework.

---

## Success Criteria

- Create cooperatives; join with Email OTP
- USDC contributions on Arc Testnet
- Treasury allocations tracked
- AI-assisted loan evaluation; interest returned to treasury
- Rotation payouts
- Agents monitor contracts
- Members receive notifications
- Circle + Arc infrastructure end-to-end

---

## Future Roadmap

Cross-cooperative lending, investment vaults, yield strategies, cross-border coops, DAO governance, mobile app, on-chain reputation, credit passport, multi-currency, institutional cooperative banking.

---

## Vision

Nexusu is building the financial operating system for community finance.

By combining AI agents, programmable money, Circle Agent Stack, and Arc Network, Nexusu transforms traditional savings groups into autonomous, transparent, and intelligent financial institutions that can scale across Africa and emerging markets.

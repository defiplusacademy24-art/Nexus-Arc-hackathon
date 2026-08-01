# Nexusu

> **The Operating System for Community Finance**

Transforming traditional savings groups into autonomous, AI-powered financial institutions using **AI Agents**, **Circle Agent Stack**, **USDC**, and **Arc Network**.

---

## Overview

**Nexusu** is a next-generation cooperative finance platform that digitises traditional community savings groups such as:

| Region | Tradition |
|--------|-----------|
| Nigeria | Esusu, Ajo |
| Kenya | Chama |
| South Africa | Stokvel |
| Latin America | Tanda |
| Worldwide | Rotating savings & credit associations (ROSCAs) |

Instead of paper records, manual bookkeeping, and fragile trust, Nexusu introduces **AI agents** that autonomously manage cooperative operations while all funds remain **transparent and programmable on-chain**.

Members join a cooperative, contribute **USDC**, apply for loans when needed, and receive automatic payouts according to the cooperative’s rules.

---

## The Problem

Over **500 million people** worldwide participate in informal savings groups.

Despite their popularity, these cooperatives struggle with:

- Manual record keeping  
- Fraud and fund mismanagement  
- Lack of transparency  
- Missed contributions  
- Loan approval bias  
- No financial identity  
- Difficult governance  
- No automated treasury management  
- Limited access to credit  
- No programmable financial infrastructure  

These issues reduce trust and limit the ability of communities to scale.

---

## Our Solution

Nexusu transforms community savings groups into **autonomous digital financial institutions**.

Using AI agents and programmable USDC, the platform automates:

- Cooperative treasury management  
- Member contribution tracking  
- Rotating payouts  
- Loan processing  
- Treasury accounting  
- Governance execution  
- Financial reporting  
- Member reminders  
- AI-powered financial insights  

Every action is transparent and secured by blockchain.

---

## Key Features

### Cooperative Management

- Create cooperatives  
- Invite members  
- Join using Email OTP  
- Manage membership  
- Select contribution schedules  
- Configure contribution amounts  

### Flexible Payout Strategies

Each cooperative can choose how members receive payouts:

| Strategy | Description |
|----------|-------------|
| **Join Order** (default) | Position assigned by join sequence |
| **Random Draw** | Fair randomised recipient selection |
| **Organizer Assigned** | Founder/admin sets positions |
| **Governance Vote** | Members vote on payout order |

The default strategy automatically assigns members a payout position based on the order they join.

### Treasury Management

AI-assisted management of cooperative funds. Deposited capital is allocated into dedicated buckets:

| Allocation | Share (default policy) | Purpose |
|------------|------------------------|---------|
| **Rotation Fund** | 60% | ROSCA / member payouts |
| **Loan Pool** | 30% | Member credit capital |
| **Emergency Reserve** | 5% | Hardship buffer |
| **Savings / Investments** | 5% | Longer-term savings (investment vault planned) |

This architecture keeps funds modular, auditable, and secure.

### AI Loan Approval

Members apply for loans from the cooperative treasury. The **Loan Agent** evaluates requests using:

- Contribution history  
- Repayment history  
- Treasury liquidity  
- Requested amount  
- Cooperative rules  
- Member reputation  
- AI risk assessment  

**Decisions:**

| Outcome | Meaning |
|---------|---------|
| **Approved** | Meets policy and liquidity rules |
| **Declined** | Outside risk / policy bounds |
| **Requires Governance Review** | Human / member ratification needed |

---

## AI Agents

Nexusu is powered by specialised agents:

| Agent | Role |
|-------|------|
| **Contribution Agent** | Tracks and verifies contributions |
| **Treasury Agent** | Manages funds and vault allocations |
| **Loan Agent** | Reviews applications and recommends approvals |
| **Rotation Agent** | Releases cooperative payouts on schedule |
| **Reminder Agent** | Notifies members about dues and repayments |
| **Governance Agent** | Executes community-approved proposals |
| **Nexa Assistant** | Conversational AI for treasury insights and Q&A |

**Make agents work end-to-end** (Circle Agent Wallets, env, on-chain roles, smoke tests):

→ **[docs/AGENT_AND_CIRCLE_WALLET_SETUP.md](./docs/AGENT_AND_CIRCLE_WALLET_SETUP.md)**

Architecture overview: [`artifacts/api-server/src/agents/README.md`](./artifacts/api-server/src/agents/README.md)

---

## Smart Contract Architecture

Each cooperative is backed by a **Cooperative Treasury Vault** on Arc, with logical buckets:

```
Treasury Vault
├── Rotation Fund
├── Loan Pool
├── Emergency Reserve
├── Savings Vault
└── Investment Vault (future)
```

Each bucket has a single responsibility—improving transparency, modularity, and security.

Contracts live under `contracts/` (Foundry + OpenZeppelin).

---

## Circle Agent Stack Integration

Nexusu uses **Circle Agent Stack** so AI agents and members can perform secure financial operations.

### Circle components

- Circle Agent Wallets  
- User-Controlled Wallets  
- Email OTP authentication  
- USDC  
- Gas Station  

Members onboard with **email**—no seed phrases required. Agents operate within programmable wallet and policy boundaries.

---

## Arc Network Integration

Nexusu targets **Arc Testnet** for:

- Treasury smart contracts  
- Vault management  
- Loan disbursement  
- Contribution settlement  
- Automated payouts  

All cooperative funds are settled in **USDC** on Arc Testnet.

---

## User Journey

### 1. Create cooperative

The organiser configures:

- Name and description  
- Contribution amount and frequency  
- Maximum members  
- Treasury allocation policy  
- Payout strategy  

### 2. Invite members

Members join via invite code and **Email OTP**. With **Join Order**, payout position is assigned automatically.

### 3. Contribute

Members deposit USDC into the cooperative treasury. Every contribution is recorded permanently.

### 4. AI treasury management

Agents monitor contributions, balances, loan liquidity, and missed payments.

### 5. Loan requests

Members submit applications. The Loan Agent evaluates them before approval or governance review.

### 6. Automatic payout

When a contribution cycle completes, the Rotation Agent:

1. Calculates the payout  
2. Verifies contribution requirements  
3. Releases funds  
4. Advances to the next recipient  

No manual intervention is required.

---

## Tech Stack

| Layer | Technologies |
|-------|----------------|
| **Frontend** | React, TypeScript, Tailwind CSS, Vite |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | PostgreSQL (Drizzle ORM) — durable on Vercel |
| **Blockchain** | Arc Testnet, Foundry smart contracts |
| **Payments** | Circle Agent Stack, USDC |
| **Authentication** | Circle User-Controlled Wallets, Email OTP |
| **AI** | Autonomous agents, loan evaluation, Nexa insights |
| **Monorepo** | pnpm workspaces |

---

## Getting Started

### Prerequisites

- Node.js 20+  
- [pnpm](https://pnpm.io)  
- (Optional) Foundry for contracts  
- (Optional) Postgres for production-like data  

### Install

```bash
pnpm install
```

### Develop

```bash
# Frontend (Vite)
pnpm --filter @workspace/nexusu run dev

# API server
pnpm --filter @workspace/api-server run dev

# Typecheck monorepo
pnpm run typecheck
```

### Contracts

```bash
cd contracts
forge test
forge script script/Deploy.s.sol:Deploy --rpc-url <ARC_RPC> --broadcast --legacy
```

### Autonomous agents + Circle Agent Wallets

Step-by-step setup (wallets, `CIRCLE_BIN`, loan `lendingAgent`, health checks):

→ **[docs/AGENT_AND_CIRCLE_WALLET_SETUP.md](./docs/AGENT_AND_CIRCLE_WALLET_SETUP.md)**

### Deploy (Vercel)

1. Import the Git repo in Vercel.  
2. Set **Root Directory** to `artifacts/nexusu`.  
3. Framework: **Other** (commands from `vercel.json`).  
4. Environment variables (examples):
   - `DATABASE_URL` — Postgres (required for durable coops / multi-device login)  
   - `CIRCLE_UC_API_KEY` — Circle user-controlled wallets  
   - `VITE_WALLETCONNECT_PROJECT_ID` — wallet connect (if used)  
   - `VITE_TREASURY_VAULT_ADDRESS` — deployed vault on Arc (e.g. `0xe287D1acD501ec2A954BA030B7387de12D248E02`)  
   - `VITE_LOAN_POOL_ADDRESS` — loan pool on Arc  
   - `VITE_COOPERATIVE_REGISTRY_ADDRESS` — multi-coop registry on Arc  
   - `VITE_ROTATION_MANAGER_ADDRESS` — rotation orchestrator on Arc  
   - `TREASURY_VAULT_ADDRESS` — same vault address as `VITE_TREASURY_VAULT_ADDRESS` (server runtime)  
   - `VAULT_OPERATOR_PRIVATE_KEY` — forge deploy private key (server only, testnet) so create/join/deposit auto-registers each Circle wallet on the vault  
   - `ARC_RPC_URL` — optional; defaults to `https://rpc.testnet.arc.network`  
   - Leave `VITE_API_URL` empty for same-origin `/api/*`  

   **Why the operator key:** users only log in with Circle wallets; the vault’s on-chain organizer is the deploy EOA. The API uses `VAULT_OPERATOR_PRIVATE_KEY` to call `registerMember` in the background when someone creates/joins a coop or deposits — no second registration UI. Keep that key as organizer (do not transfer organizer away).

   After changing any `VITE_*` variable, **redeploy** so the frontend rebuild picks them up.

```bash
pnpm run build:vercel
```

---

## Repository Layout

```
Nexus-Arc-hackathon/
├── artifacts/nexusu/     # React app + Vercel config
├── artifacts/api-server/# Express API
├── contracts/           # CooperativeTreasuryVault (Foundry)
├── lib/                 # Shared packages (db, api-client, zod)
└── README.md
```

---

## Why Nexusu?

Unlike generic fintech products, Nexusu is built **specifically for community finance**. It combines:

- AI automation  
- Blockchain transparency  
- Stablecoin payments  
- Autonomous treasury management  
- Digital cooperative governance  

…to modernise informal savings groups **without changing how communities naturally save together**.

---

## Future Roadmap

- [ ] Investment vaults  
- [ ] Yield optimisation  
- [ ] Cross-border cooperatives  
- [ ] AI fraud detection  
- [ ] Deeper AI financial advisor  
- [ ] On-chain reputation and credit scores  
- [ ] Native mobile application  
- [ ] Multi-currency support  
- [ ] Cooperative DAO governance  
- [ ] Autonomous investment agents  

---

## Impact

Nexusu aims to unlock financial inclusion for millions who rely on community savings groups by making cooperative finance:

**Transparent · Secure · Autonomous · Intelligent · Accessible · Borderless**

---

## Built For

**Arc Hackathon**

Powered by:

- Arc Network  
- Circle Agent Stack  
- USDC  
- Autonomous AI Agents  

---

## Team

**Nexusu** — *The Operating System for Community Finance*

> Building the future of community finance—one autonomous cooperative at a time.

---

## License

Proprietary / hackathon submission unless otherwise stated by the team.

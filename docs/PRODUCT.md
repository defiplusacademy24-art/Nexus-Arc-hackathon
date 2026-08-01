# Nexusu

## The Operating System for Community Finance

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Status | Arc Hackathon MVP |
| Network | Arc Testnet |
| Stablecoin | USDC |
| AI Infrastructure | Circle Agent Stack |

---

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

| Layer | Stack |
| --- | --- |
| Frontend | React, TypeScript, Tailwind CSS, Vite |
| Backend | Node.js, Express, TypeScript |
| Blockchain | Arc Testnet, Solidity, Foundry, OpenZeppelin, viem |
| Authentication | Circle User-Controlled Wallets, Email OTP |
| Payments | USDC on Arc |
| AI | Circle Agent Stack, SpaceXAI / OpenAI-compatible SDK |

## System Architecture

```text
Users
  → Frontend (React)
  → Backend API (Express)
  → Circle User-Controlled Wallets
  → Arc Smart Contracts (USDC)
  → Circle Agent Stack
  → Autonomous AI Agents
```

## Smart Contracts

### Cooperative Registry

Creates cooperatives, manages joins, settings, payout strategy, member order, and metadata.

### Treasury Vault

Receives contributions and accounts for:

| Bucket | Share |
| --- | --- |
| Rotation Fund | 60% |
| Loan Pool | 30% |
| Emergency Reserve | 5% |
| Savings Reserve | 5% |

When `lendingPool` is set, the loan share is forwarded into the Cooperative Loan Pool on each deposit.

### Loan Pool

Loan capital, disbursement, repayments, interest; pending applications can be edited or cancelled by the borrower; organizer/lending agent approves.

### Rotation Manager

Payout recipient, execution, advance, history. Strategies: Join Order, Random Draw, Organizer Assigned, Governance Vote.

## Circle Integration

Members use Circle User-Controlled Wallets + Email OTP. No seed phrases.

## Circle Agent Stack

Independent least-privilege agent wallets (Treasury, Loan, Rotation, Savings, Governance, Notification, Fraud, Nexa). Agents never custody funds.

## AI Agents

See in-app `/docs` for full agent responsibilities. In short: Treasury monitors; Contribution tracks dues; Rotation pays out; Loan underwrites; Savings recommends; Governance executes votes; Fraud alerts; Nexa assists members privately.

## Cooperative Lifecycle

1. Create cooperative  
2. Members join (OTP + Circle wallet)  
3. Contribute USDC  
4. Allocate (rotation / loan / emergency / savings)  
5. Lend and repay  
6. Rotate payouts  

## Loan Rules

| Term | Rate |
| --- | --- |
| 1 month | 5% |
| 2 months | 6% |
| 3 months | 7% |
| 4 months | 8% |
| 5 months | 9% |
| 6 months | 10% |

Default max single loan: **25% of pool liquidity** at approval.

## Savings Module

Cooperative savings (5% treasury allocation), not personal savings. Yield from loan interest today.

## Governance

Members vote; AI recommends; members decide.

## Security

No private keys in the app · Circle UC + Agent Wallets · role checks · OpenZeppelin · rate limits · idempotent agents

## Vision

Nexusu is building the financial operating system for community finance — autonomous, transparent cooperatives on Arc with Circle and AI.

For agent deployment: [AGENT_AND_CIRCLE_WALLET_SETUP.md](./AGENT_AND_CIRCLE_WALLET_SETUP.md)

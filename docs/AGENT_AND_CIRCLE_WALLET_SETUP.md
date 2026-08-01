# Nexusu Autonomous Agents + Circle Agent Wallet Setup

**End-to-end guide so the multi-agent system actually works on Arc Network.**

Follow this document in order. When you finish, agents will:

- Watch on-chain events (deposits, loans, rotations)
- Decide with AI (SpaceXAI / xAI)
- Store memory, tasks, and audit logs in Postgres
- Call **approved** smart-contract functions using **Circle Agent Wallets**
- **Never hold member funds** (USDC stays in the vault / loan pool contracts)

| Doc | Path |
|-----|------|
| This guide | `docs/AGENT_AND_CIRCLE_WALLET_SETUP.md` |
| Architecture | `artifacts/api-server/src/agents/README.md` |
| Env template | `artifacts/api-server/.env.example` |
| Code | `artifacts/api-server/src/agents/` |

---

## Table of contents

1. [How this works (read first)](#1-how-this-works-read-first)
2. [Prerequisites checklist](#2-prerequisites-checklist)
3. [Know your deployed contracts](#3-know-your-deployed-contracts)
4. [Create Circle Agent Wallets](#4-create-circle-agent-wallets)
5. [Install and authenticate Circle CLI](#5-install-and-authenticate-circle-cli)
6. [Grant on-chain permissions](#6-grant-on-chain-permissions)
7. [Configure the API server](#7-configure-the-api-server)
8. [Start the agent worker](#8-start-the-agent-worker)
9. [Verify agents are healthy](#9-verify-agents-are-healthy)
10. [Smoke-test each critical path](#10-smoke-test-each-critical-path)
11. [What each wallet is for](#11-what-each-wallet-is-for)
12. [Troubleshooting](#12-troubleshooting)
13. [Security checklist](#13-security-checklist)
14. [Copy-paste env template](#14-copy-paste-env-template)

---

## 1. How this works (read first)

```
Arc contracts (hold money)
        │ events
        ▼
Chain listeners (viem)
        │ domain events
        ▼
Event bus → durable task queue (Postgres)
        │
        ▼
Independent AI agents (decide)
        │ only if approved + allowed
        ▼
Circle Agent Wallet (CIRCLE_BIN) → contract call on Arc
```

**Important distinctions**

| Concept | Meaning |
|---------|---------|
| **Nexusu agents** | Our Node/TS services (treasury, loan, rotation, nexa, …) |
| **Circle Agent Wallets** | Wallets that **sign/submit** txs; one per agent role |
| **Member wallets** | User Circle email/PIN wallets — not agent wallets |
| **Custody** | Funds stay in **Treasury Vault / Loan Pool / Registry flow** — never in agent wallets |

Agents are **not** “turn on Circle and they auto-run forever with no setup.”  
You must: create wallets → set addresses in env → grant on-chain roles → run the long-lived API worker.

### Which agents can change chain state?

| Agent | Mutates chain? | Contract call |
|-------|----------------|---------------|
| **Rotation** | Yes | `RotationManager.executeRotation(coopId)` |
| **Loan** | Yes | `LoanPool.approveLoan` / `rejectLoan` |
| Treasury | No | Read / recommend / alert only |
| Contribution | No | Reminders / cycle signals only |
| Savings | No | Recommendations only |
| Governance | Policy | Summaries / vote tracking (no blind execution) |
| Fraud | No | Risk alerts only |
| Nexa | No | Member Q&A only |
| Notification | No | Dashboard notifications only |

**Minimum wallets to make automation real:** Rotation + Loan.  
Configure all nine if you want full least-privilege identity and future expansion.

---

## 2. Prerequisites checklist

Before starting:

- [ ] Access to this repo (`Nexus-Arc-hackathon`)
- [ ] Arc Testnet RPC working: `https://rpc.testnet.arc.network` (chain ID `5042002`)
- [ ] Deployed (or known) addresses for:
  - Cooperative Registry  
  - Treasury Vault  
  - Loan Pool  
  - Rotation Manager  
- [ ] Postgres database (Neon / Supabase / Railway / local) — **required when agents are enabled**
- [ ] Circle developer account: [console.circle.com](https://console.circle.com)
- [ ] xAI API key for decisions: [console.x.ai](https://console.x.ai) (`XAI_API_KEY`)
- [ ] A **long-running** host for the API (VPS, Railway service, local machine).  
  **Do not rely on Vercel serverless alone** for the agent worker loop.
- [ ] Foundry / cast optional but useful for granting `setLendingAgent`
- [ ] Arc testnet gas (native USDC) + ERC-20 USDC for contracts  
  - Explorer: https://testnet.arcscan.app  
  - Faucet: https://faucet.circle.com  
  - ERC-20 USDC: `0x3600000000000000000000000000000000000000`

---

## 3. Know your deployed contracts

### 3.1 Addresses used by this hackathon deploy (Arc Testnet)

From Foundry broadcast files in this repo (verify on Arcscan before production use):

| Contract | Address |
|----------|---------|
| **Treasury Vault** | `0xe287D1acD501ec2A954BA030B7387de12D248E02` |
| **Loan Pool** | `0x52cb1d7fabf31a915eed64e9553a67ff0eefe077` |
| **Registry** | `0x0e80fc894d8834c2e9001a85921c42bfe6c541a1` |
| **Rotation Manager** | `0xe1b3eacf68b9984a482a69423c6b2a957a80788c` |
| **USDC (ERC-20)** | `0x3600000000000000000000000000000000000000` |

> If you redeployed contracts, **use your new addresses** everywhere below.  
> Check: `contracts/broadcast/*/5042002/run-latest.json` and Arcscan.

### 3.2 Auto loan funding (treasury → loan pool)

When the vault’s `lendingPool` is set to the CooperativeLoanPool address:

- Each member **deposit** automatically sends the **loan share** (default 30%) into the loan pool via `fundPool`.
- `DeployLoan.s.sol` wires this with `vault.setLendingPool(pool)` when `TREASURY_VAULT` is set.
- Founder can push residual vault loan allocation with `pushLoanAllocationToPool()`.
- Manual `fundPool` is **founder/organizer only** (or the membership vault itself).

Redeploy vault + loan (or call `setLendingPool` on a new vault build) for this path. Older vaults without `lendingPool` keep loan share inside the vault until the founder funds manually.

### 3.2 Confirm contracts on-chain

```bash
# Example with cast (Foundry)
export ARC_RPC=https://rpc.testnet.arc.network

cast code 0xe287D1acD501ec2A954BA030B7387de12D248E02 --rpc-url $ARC_RPC | head -c 20
cast code 0x52cb1d7fabf31a915eed64e9553a67ff0eefe077 --rpc-url $ARC_RPC | head -c 20
cast code 0x0e80fc894d8834c2e9001a85921c42bfe6c541a1 --rpc-url $ARC_RPC | head -c 20
cast code 0xe1b3eacf68b9984a482a69423c6b2a957a80788c --rpc-url $ARC_RPC | head -c 20
```

Non-empty bytecode = contract is there.

---

## 4. Create Circle Agent Wallets

You need **independent** wallets — **never share** one wallet across agents.

### 4.1 Why separate wallets

| Risk if shared | Impact |
|----------------|--------|
| Compromised key path | All agent powers fail together |
| Hard to audit | Cannot tell loan vs rotation in explorer |
| Least privilege broken | Loan agent could be given rotation rights by accident |

### 4.2 Create wallets in Circle Console

1. Open [Circle Console](https://console.circle.com) → **Programmable Wallets** / **Web3 Services**.
2. Create (or use) a project for **Arc Testnet**.
3. Create **developer-controlled** or **agent** wallets as supported by your Circle plan  
   (product name may appear as “Agent Wallets”, “Developer-Controlled Wallets”, or similar).
4. Create **nine** wallets with clear labels:

| Label | Env var |
|-------|---------|
| Nexusu Treasury Agent | `CIRCLE_AGENT_WALLET_TREASURY_ADDRESS` |
| Nexusu Contribution Agent | `CIRCLE_AGENT_WALLET_CONTRIBUTION_ADDRESS` |
| Nexusu Rotation Agent | `CIRCLE_AGENT_WALLET_ROTATION_ADDRESS` |
| Nexusu Loan Agent | `CIRCLE_AGENT_WALLET_LOAN_ADDRESS` |
| Nexusu Savings Agent | `CIRCLE_AGENT_WALLET_SAVINGS_ADDRESS` |
| Nexusu Governance Agent | `CIRCLE_AGENT_WALLET_GOVERNANCE_ADDRESS` |
| Nexusu Fraud Agent | `CIRCLE_AGENT_WALLET_FRAUD_ADDRESS` |
| Nexusu Nexa Assistant | `CIRCLE_AGENT_WALLET_NEXA_ADDRESS` |
| Nexusu Notification Agent | `CIRCLE_AGENT_WALLET_NOTIFICATION_ADDRESS` |

5. For each wallet, copy the **EVM address** (`0x` + 40 hex chars).
6. **Do not** export seed phrases into this repo, `.env` committed files, or the frontend.
7. Fund **Rotation** and **Loan** agent wallets with a small amount of **Arc native gas USDC** so they can pay gas for txs.

> Member login wallets (email OTP + PIN via `CIRCLE_UC_API_KEY`) are **different**.  
> Those are for humans. Agent wallets are for automation.

### 4.3 Minimum set if you are short on time

Create at least:

1. **Rotation Agent Wallet**
2. **Loan Agent Wallet**

Other agents can run **observe / decide / notify** without wallets; health will show `walletConfigured: false` for missing ones.

---

## 5. Install and authenticate Circle CLI

The runtime **never** loads private keys. It shells out to Circle CLI:

```text
CIRCLE_BIN → circle wallet execute ... --address <agentWallet> --chain ARC-TESTNET
```

### 5.1 Install Circle CLI

Follow Circle’s current docs for the CLI used with Programmable / Agent Wallets:

- Circle Developer docs: https://developers.circle.com  
- Console: https://console.circle.com  

Install so you have a binary on the server, for example:

```bash
# Example — use the install method from Circle’s current docs
which circle
circle --version
```

If your binary is named differently (e.g. `circle-wallets`), still set:

```bash
export CIRCLE_BIN=/full/path/to/that/binary
```

### 5.2 Authenticate the CLI (server)

On the **same machine** that runs the API worker:

1. Log in / configure API key as Circle documents for server usage.
2. Confirm the CLI can see your agent wallets:

```bash
# Commands vary by CLI version — use Circle’s help
"$CIRCLE_BIN" --help
"$CIRCLE_BIN" wallet --help
```

3. Dry-run a **read-only** or test-net execute if Circle provides a sandbox command.

### 5.3 What Nexusu sends

From `artifacts/api-server/src/agents/wallets.ts`, mutating calls look like:

```bash
$CIRCLE_BIN wallet execute \
  <functionSignature> \
  <args...> \
  --contract <contractAddress> \
  --address <agentWalletAddress> \
  --chain ARC-TESTNET \
  --idempotency-key <key> \
  --output json
```

Expected JSON includes a tx hash, e.g. `{ "data": { "txHash": "0x..." } }`.

If your CLI flag names differ slightly from this adapter, update `wallets.ts` to match **your** CLI version — do not put keys in the app.

---

## 6. Grant on-chain permissions

Wallets alone are not enough. Contracts must **allow** those addresses.

### 6.1 Loan Agent → `lendingAgent` on Loan Pool (**required for auto approve/reject**)

Only the **organizer** can call:

```solidity
setLendingAgent(address agent)
```

**Using cast** (replace keys/addresses):

```bash
export ARC_RPC=https://rpc.testnet.arc.network
export ORGANIZER_PK=0x...   # organizer / deployer private key — testnet only
export LOAN_POOL=0x52cb1d7fabf31a915eed64e9553a67ff0eefe077
export LOAN_AGENT_WALLET=0xYourLoanAgentWallet

cast send $LOAN_POOL \
  "setLendingAgent(address)" \
  $LOAN_AGENT_WALLET \
  --rpc-url $ARC_RPC \
  --private-key $ORGANIZER_PK
```

**Verify:**

```bash
cast call $LOAN_POOL "lendingAgent()(address)" --rpc-url $ARC_RPC
# should print LOAN_AGENT_WALLET
```

Optional but recommended — forward loan interest profit to Treasury:

```bash
export TREASURY=0xe287D1acD501ec2A954BA030B7387de12D248E02

cast send $LOAN_POOL \
  "setProfitRecipient(address)" \
  $TREASURY \
  --rpc-url $ARC_RPC \
  --private-key $ORGANIZER_PK

# Optional: only vault members may apply
cast send $LOAN_POOL \
  "setMembershipVault(address)" \
  $TREASURY \
  --rpc-url $ARC_RPC \
  --private-key $ORGANIZER_PK
```

**Fund the loan pool** with USDC so approvals can disburse:

```bash
# Organizer or treasury ops: approve USDC then fundPool(amount)
# amount is 6-decimal USDC base units (1 USDC = 1000000)
```

### 6.2 Rotation Agent + Rotation Manager

- `executeRotation(coopId)` is callable by the agent **if** the vault/rotation path is ready.
- Against a **real** recipient-gated Treasury Vault, payout may require the **current recipient** to claim (`triggerPayout`) and then registry advance — see comments in `RotationManager.sol`.
- For hackathon flows that use permissionless/mock-ready vaults, the agent can call `executeRotation` when the contribution cycle is complete.
- Ensure Rotation Manager is linked on the Registry (`setRotationManager` already done in deploy scripts if you used them).
- Rotation agent wallet needs **gas** on Arc Testnet.

**Idempotency:** the Rotation agent stores `rotation:executed:<coopId>:<cycle>` in memory so it **does not double-pay**.

### 6.3 What you do **not** grant

| Do not | Why |
|--------|-----|
| Give Fraud/Nexa/Notification `approveLoan` | Breaks least privilege |
| Put organizer private key in agent env for production | Use Circle wallets + limited roles |
| Transfer vault organizer to a hot agent wallet casually | High risk; keep organizer controlled |

---

## 7. Configure the API server

### 7.1 Create env file

```bash
cd artifacts/api-server
cp .env.example .env
# edit .env — never commit it
```

### 7.2 Required variables when `AGENTS_ENABLED=true`

| Variable | Purpose |
|----------|---------|
| `AGENTS_ENABLED=true` | Start runtime + chain listeners |
| `DATABASE_URL` | Postgres for events, tasks, memory, audit |
| `CIRCLE_BIN` | Path to authenticated Circle CLI |
| `XAI_API_KEY` | AI decisions + Nexa (SpaceXAI / xAI) |
| `COOPERATIVE_REGISTRY_ADDRESS` | Registry contract |
| `TREASURY_VAULT_ADDRESS` | Treasury vault |
| `LOAN_POOL_ADDRESS` | Loan pool |
| `ROTATION_MANAGER_ADDRESS` | Rotation manager |
| `CIRCLE_AGENT_WALLET_ROTATION_ADDRESS` | Execute rotations |
| `CIRCLE_AGENT_WALLET_LOAN_ADDRESS` | Approve/reject loans |

### 7.3 Strongly recommended

| Variable | Purpose |
|----------|---------|
| `ARC_RPC_URL` | Defaults to public Arc testnet RPC |
| `XAI_AGENT_MODEL` | Default `grok-4.5` |
| `AGENT_POLL_INTERVAL_MS` | Default `12000` (task drain) |
| `AGENT_MAX_RETRIES` | Default `5` |
| `AGENT_RATE_LIMIT_MAX_WALLET_CALLS` | Default `10` per minute per agent |
| All other `CIRCLE_AGENT_WALLET_*` | Full multi-agent identity |
| `CIRCLE_UC_API_KEY` | Member email wallets (app users) — separate from agents |
| `VAULT_OPERATOR_PRIVATE_KEY` | **Testnet only** — register members on vault |

### 7.4 Full example

See [§14 Copy-paste env template](#14-copy-paste-env-template).

### 7.5 Postgres

```bash
# From repo root — ensure schema exists
pnpm --filter @workspace/db run push
# or let agent runtime create agent_* tables on start
```

Agent tables (auto-created):

- `agent_events`
- `agent_tasks`
- `agent_memory`
- `agent_audit_log`

---

## 8. Start the agent worker

Agents need a **long-running** Node process (not a single serverless invoke).

### 8.1 Local / VM

```bash
# From monorepo root
pnpm install

# Ensure env is loaded for api-server
cd artifacts/api-server
# .env present with AGENTS_ENABLED=true

pnpm run build
pnpm run start
# or: pnpm --filter @workspace/api-server start
```

On boot you should see logs similar to:

```text
Server listening { port: 8080 }
Autonomous multi-agent runtime started { agents: [ 'treasury', ... ] }
Chain listeners started { watchers: 9, ... }
```

### 8.2 Production host notes

| Platform | Guidance |
|----------|----------|
| Railway / Render / Fly / VM | Good — run `start` as a service |
| Docker | One container, restart policy `always` |
| Vercel serverless | Hosts the **HTTP app** only; **do not** rely on it for the agent poll loop |
| Process manager | `systemd`, PM2, or platform process |

### 8.3 Keep agents off in pure frontend deploys

```bash
AGENTS_ENABLED=false   # default — safe for Vercel API routes only
```

Run a **second service** with agents enabled for automation.

---

## 9. Verify agents are healthy

### 9.1 Health endpoint

```bash
curl -s http://localhost:8080/api/agents/health | jq
```

Expect:

```json
{
  "enabled": true,
  "llmConfigured": true,
  "llmModel": "grok-4.5",
  "contracts": { "registry": "0x...", "treasury": "0x...", "loanPool": "0x...", "rotationManager": "0x..." },
  "agents": [
    {
      "agent": "loan",
      "ready": true,
      "queueDepth": 0,
      "walletConfigured": true,
      "walletAddress": "0x..."
    }
  ]
}
```

### 9.2 Catalog

```bash
curl -s http://localhost:8080/api/agents | jq '.agents[] | {name, walletConfigured, walletAddress}'
```

### 9.3 Checklist after health check

- [ ] `enabled: true`
- [ ] `llmConfigured: true` (set `XAI_API_KEY`)
- [ ] All four contract addresses present
- [ ] `rotation.walletConfigured: true`
- [ ] `loan.walletConfigured: true`
- [ ] No fatal errors in server logs

---

## 10. Smoke-test each critical path

### 10.1 Interest quote (no wallet needed)

```bash
curl -s "http://localhost:8080/api/agents/loans/quote?principal=1000&termMonths=3" | jq
```

Expect 7% simple interest for 3 months (total interest `70` if principal is 1000 units).

### 10.2 Nexa assistant (member-scoped)

```bash
curl -s -X POST http://localhost:8080/api/agents/nexa/ask \
  -H "Content-Type: application/json" \
  -H "x-wallet-address: 0xYourMemberWallet" \
  -d '{"question":"What is the loan interest for 6 months?","loanPrincipal":500,"termMonths":6}' | jq
```

### 10.3 Inject a domain event (ops / test)

```bash
curl -s -X POST http://localhost:8080/api/agents/events \
  -H "Content-Type: application/json" \
  -d '{
    "name": "loan.applied",
    "idempotencyKey": "test-loan-applied-1",
    "payload": {
      "loanId": "1",
      "borrower": "0xabc...",
      "principal": "100000000",
      "termMonths": 3,
      "creditScore": 75,
      "autonomousApproval": false
    }
  }' | jq
```

Then:

```bash
curl -s "http://localhost:8080/api/agents/audit?limit=20" | jq
curl -s "http://localhost:8080/api/agents/loan/memory" | jq
```

With `autonomousApproval: false` or missing evidence, Loan Agent should prefer **`governance_review`** (fail closed) — that is correct.

### 10.4 Live chain path (real money movement on testnet)

1. Member deposits to Treasury Vault (app or cast).
2. Watch logs / `GET /api/agents/events` for `contribution.received` / `treasury.updated`.
3. When cycle is complete, Rotation Agent may attempt `executeRotation` (if approved + wallet set).
4. Member applies for loan on Loan Pool → `loan.applied` → Loan Agent decides.
5. If autonomous + approved + `lendingAgent` set → `approveLoan` via Circle wallet.
6. Check Arcscan for the agent wallet’s txs.
7. Check `GET /api/agents/audit` for `status: success` and `tx_hash`.

### 10.5 Loan interest schedule (must match contract)

| Term (months) | Interest |
|---------------|----------|
| 1 | 5% |
| 2 | 6% |
| 3 | 7% |
| 4 | 8% |
| 5 | 9% |
| 6 | 10% |

Simple interest on principal for the full term (see `CooperativeLoanPool` + `agents/interest.ts`).

---

## 11. What each wallet is for

| Agent | Wallet env | On-chain writes | Typical work |
|-------|------------|-----------------|--------------|
| Treasury | `..._TREASURY_ADDRESS` | None | Deposits, balances, anomaly alerts |
| Contribution | `..._CONTRIBUTION_ADDRESS` | None | Deadlines, cycle complete signal |
| Rotation | `..._ROTATION_ADDRESS` | `executeRotation` | Payouts once per cycle |
| Loan | `..._LOAN_ADDRESS` | `approveLoan` / `rejectLoan` | Risk eval + disburse/reject |
| Savings | `..._SAVINGS_ADDRESS` | None | Allocation recommendations |
| Governance | `..._GOVERNANCE_ADDRESS` | Policy only | Proposals, loan overrides |
| Fraud | `..._FRAUD_ADDRESS` | None | low / medium / high / critical alerts |
| Nexa | `..._NEXA_ADDRESS` | None | Member financial Q&A |
| Notification | `..._NOTIFICATION_ADDRESS` | None | Dashboard (future email/push) |

---

## 12. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Server exits on start with contract error | Missing contract env | Set all four `*_ADDRESS` vars |
| `DATABASE_URL is required` | No Postgres | Set `DATABASE_URL` |
| `CIRCLE_BIN must point to...` | CLI missing | Install CLI; set absolute path |
| `walletConfigured: false` | Env address missing/invalid | Set `CIRCLE_AGENT_WALLET_*` with checksummed `0x` |
| `Policy denied agent...` | Function not allowlisted | Only rotation/loan mutate; check `wallets.ts` |
| `Circle Agent Wallet not configured` | Wallet env empty | Create wallet + set env + restart |
| Loan approve reverts `NotApprover` | `lendingAgent` not set | Call `setLendingAgent(loanWallet)` as organizer |
| Loan approve reverts `InsufficientLiquidity` | Pool empty | `fundPool` with USDC |
| Rotation reverts `VaultNotReady` | Cycle incomplete / payout not ready | Wait until all required contributions paid |
| Double rotation blocked | Idempotency memory | Expected — check agent memory key |
| Decisions always `governance_review` | No `XAI_API_KEY` or model error | Set key; check model name; read audit log |
| No chain events | Wrong addresses / RPC / agents off | Health check; verify watchers in logs |
| Rate limited wallet calls | Too many txs | Raise `AGENT_RATE_LIMIT_MAX_WALLET_CALLS` carefully |
| Works locally, not on Vercel | Serverless has no long poll loop | Run dedicated worker service |

### Useful log / API checks

```bash
# Recent agent decisions & txs
curl -s "http://localhost:8080/api/agents/audit?limit=50" | jq

# Domain event ledger
curl -s "http://localhost:8080/api/agents/events?limit=50" | jq

# Per-agent memory
curl -s "http://localhost:8080/api/agents/rotation/memory" | jq
curl -s "http://localhost:8080/api/agents/loan/memory" | jq
```

---

## 13. Security checklist

- [ ] No seed phrases or private keys in git
- [ ] `.env` in `.gitignore` (never commit agent secrets)
- [ ] One wallet per agent; least privilege
- [ ] Loan agent is only `lendingAgent`, not vault organizer (unless you explicitly design that)
- [ ] `VAULT_OPERATOR_PRIVATE_KEY` is **testnet only**
- [ ] Rate limits left on for wallet executes
- [ ] Fail closed: missing evidence → governance review, not silent approve
- [ ] Agents never transfer USDC to themselves as “custody”
- [ ] Production: restrict who can `POST /api/agents/events` (add auth before public internet)
- [ ] Monitor `/api/agents/audit` for unexpected wallet txs

---

## 14. Copy-paste env template

Save as `artifacts/api-server/.env` (do **not** commit):

```bash
PORT=8080
LOG_LEVEL=info

# ── Postgres (required for agents) ──────────────────────────────────────────
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/nexusu?sslmode=require

# ── Member Circle user-controlled wallets (app login — separate from agents) ─
CIRCLE_UC_API_KEY=TEST_API_KEY:your_key_here
# CIRCLE_UC_BLOCKCHAIN=ARC-TESTNET
# CIRCLE_UC_ACCOUNT_TYPE=SCA

# ── Arc ─────────────────────────────────────────────────────────────────────
ARC_RPC_URL=https://rpc.testnet.arc.network

# Deployed contracts (update if you redeployed)
COOPERATIVE_REGISTRY_ADDRESS=0x0e80fc894d8834c2e9001a85921c42bfe6c541a1
TREASURY_VAULT_ADDRESS=0xe287D1acD501ec2A954BA030B7387de12D248E02
LOAN_POOL_ADDRESS=0x52cb1d7fabf31a915eed64e9553a67ff0eefe077
ROTATION_MANAGER_ADDRESS=0xe1b3eacf68b9984a482a69423c6b2a957a80788c

# Testnet-only: register Circle member wallets on vault
# VAULT_OPERATOR_PRIVATE_KEY=0x...

# ── Autonomous agents ───────────────────────────────────────────────────────
AGENTS_ENABLED=true
CIRCLE_BIN=/usr/local/bin/circle

# SpaceXAI (xAI) — decisions + Nexa
XAI_API_KEY=xai-your-key-here
XAI_AGENT_MODEL=grok-4.5
XAI_BASE_URL=https://api.x.ai/v1

AGENT_POLL_INTERVAL_MS=12000
AGENT_MAX_RETRIES=5
AGENT_RATE_LIMIT_WINDOW_MS=60000
AGENT_RATE_LIMIT_MAX_WALLET_CALLS=10

# Circle Agent Wallets — one address per agent (never share)
CIRCLE_AGENT_WALLET_TREASURY_ADDRESS=0x...
CIRCLE_AGENT_WALLET_CONTRIBUTION_ADDRESS=0x...
CIRCLE_AGENT_WALLET_ROTATION_ADDRESS=0x...
CIRCLE_AGENT_WALLET_LOAN_ADDRESS=0x...
CIRCLE_AGENT_WALLET_SAVINGS_ADDRESS=0x...
CIRCLE_AGENT_WALLET_GOVERNANCE_ADDRESS=0x...
CIRCLE_AGENT_WALLET_FRAUD_ADDRESS=0x...
CIRCLE_AGENT_WALLET_NEXA_ADDRESS=0x...
CIRCLE_AGENT_WALLET_NOTIFICATION_ADDRESS=0x...
```

---

## Quick start (shortest path to “it works”)

1. **Postgres** → set `DATABASE_URL`  
2. **Contracts** → set four addresses (use §3 if still on hackathon deploy)  
3. **Circle** → create **Loan** + **Rotation** agent wallets; fund gas  
4. **CLI** → install, auth, set `CIRCLE_BIN`  
5. **On-chain** → `setLendingAgent(loanWallet)` on Loan Pool  
6. **AI** → set `XAI_API_KEY`  
7. **Env** → `AGENTS_ENABLED=true` + wallet addresses  
8. **Run** → `pnpm --filter @workspace/api-server start`  
9. **Check** → `curl localhost:8080/api/agents/health`  
10. **Smoke** → loan quote + inject test event + audit log  

When health shows wallets configured, audit shows decisions, and Arcscan shows agent txs for approve/rotation, the agents are working end-to-end.

---

## Related code map

```
artifacts/api-server/src/agents/
  runtime.ts           # start / drain / wallet execute
  chain-listener.ts    # Arc events → domain events
  wallets.ts           # Circle CLI + allowlists
  services/*.ts        # one file per agent
  interest.ts          # 5%–10% loan schedule
  store.ts             # Postgres queue + memory + audit
  config.ts            # env parsing
routes/agents.ts       # HTTP API
index.ts               # starts agents when AGENTS_ENABLED=true
```

Questions while following this guide: open an issue on the repo or re-check `/api/agents/health` and `/api/agents/audit` first — those two endpoints answer most “is it working?” questions.

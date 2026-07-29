# Cooperative Treasury Vault (Arc)

Solidity vault for Nexusu cooperatives on **Arc Testnet** (chain ID `5042002`).

Holds member **USDC** contributions, allocates them across configured buckets, tracks per-cycle status, and pays out using the cooperative’s rotation strategy.

## Contract

`src/CooperativeTreasuryVault.sol`

| Responsibility | Implementation |
| --- | --- |
| Receive / hold USDC | `deposit()` / `depositFor()` via ERC-20 `transferFrom` |
| Record contributions | `ContributionRecord` history + events |
| Treasury balance | `getTreasuryBalance()`, virtual buckets |
| Auto-allocate deposits | `AllocationConfig` (bps → Rotation / Loan / Emergency / Savings) |
| Member history | `getMemberContributionHistory(address)` |
| Cycle status | `getContributionStatus(address)` |
| Payout strategies | JoinOrder · RandomDraw · OrganizerAssigned · GovernanceVote |
| Trigger payout | `triggerPayout()` when all required members paid |

### Allocation (basis points, sum = 10_000)

Default (deploy script — matches Nexusu product policy):

- Rotation Fund **60%** (`ROTATION_BPS=6000`)
- Loan Pool **30%** (`LOAN_POOL_BPS=3000`)
- Emergency Reserve **5%** (`EMERGENCY_BPS=500`)
- Savings / Investment **5%** (`SAVINGS_BPS=500`)

Payouts draw from the **Rotation Fund** share accumulated in the current cycle.

### Join Order (default)

1. Members get a permanent `joinPosition` on `registerMember`.
2. Position `#1` receives the first cycle payout, then `#2`, …
3. After the last member, rotation wraps to `#1`.

### Security

- Only registered **active** members may deposit
- One contribution per member per cycle
- One payout per cycle (`cyclePayoutCompleted`)
- Fixed `contributionAmount` (≥ $10 USDC; exact amount per cycle)
- Founder schedule: `contributionFrequency` — Weekly / BiWeekly / Monthly
- Organizer can update rules via `setContributionRules(amount, frequency)` between cycles
- `ReentrancyGuard` + OpenZeppelin `SafeERC20`
- Events: `MemberRegistered`, `ContributionDeposited`, `PayoutExecuted`, `CycleCompleted`, …

## Arc network

| Field | Value |
| --- | --- |
| Network | Arc Testnet |
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | https://testnet.arcscan.app |
| USDC ERC-20 | `0x3600000000000000000000000000000000000000` (6 decimals) |
| Faucet | https://faucet.circle.com |

> Native gas on Arc is also USDC (18 decimals). Contributions use the **ERC-20 USDC** address above (6 decimals).

## Setup

```bash
# Foundry: https://book.getfoundry.sh/getting-started/installation
cd contracts
forge install foundry-rs/forge-std --no-git --shallow
forge install OpenZeppelin/openzeppelin-contracts@v5.2.0 --no-git --shallow
forge build
forge test -vv
```

## Deploy to Arc Testnet

```bash
cd contracts
cp .env.example .env
# set PRIVATE_KEY (funded with Arc testnet USDC for gas)

source .env   # or export vars

forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://rpc.testnet.arc.network \
  --broadcast \
  --legacy
```

Optional env vars: `ORGANIZER`, `COOP_NAME`, `CONTRIBUTION_AMOUNT` (raw 6-decimal units, min `10e6` / $10, default `50e6`), `CONTRIBUTION_FREQUENCY` (`0` weekly · `1` bi-weekly · `2` monthly), allocation BPS, `REGISTER_ORGANIZER`.

## Member flow (after deploy)

```text
organizer  → registerMember(alice) / registerMembers([...])
each member → USDC.approve(vault, contributionAmount)
each member → vault.deposit()
anyone      → vault.triggerPayout()   // when canTriggerPayout() is ready
```

## Frontend integration (viem / wagmi)

```ts
import { ARC_USDC_ERC20_ADDRESS } from '@/config/arc';

// After deploy, set:
// VITE_TREASURY_VAULT_ADDRESS=0x...
```

ABI: `out/CooperativeTreasuryVault.sol/CooperativeTreasuryVault.json` after `forge build`.


## Cooperative Registry + Rotation Manager

`src/CooperativeRegistry.sol` — multi-coop membership, join positions, settings.  
`src/RotationManager.sol` — join-order rotation orchestration; calls existing Treasury `triggerPayout()`.

### Deploy (does not redeploy treasury / loan pool)

```bash
source .env
export TREASURY_VAULT_ADDRESS=0x...   # existing
export LOAN_POOL_ADDRESS=0x...
forge script script/DeployRegistry.s.sol:DeployRegistry \
  --rpc-url "$ARC_RPC_URL" \
  --broadcast --legacy
```

Frontend:

```bash
VITE_COOPERATIVE_REGISTRY_ADDRESS=0x...
VITE_ROTATION_MANAGER_ADDRESS=0x...
```

### Cooperative Loan Pool

`src/CooperativeLoanPool.sol` — production on-chain member loans with term-based interest (5–10%).

### Rules

| Rule | Detail |
| --- | --- |
| Eligibility | `membershipVault.isMember` **or** local `registerBorrower` |
| One open loan | Pending / Active / Defaulted blocks a new application |
| Terms | 1–6 months → 5%–10% simple interest |
| Max size | Default **25%** of `availableLiquidity()` at approve time |
| Repay | Interest first, then principal (partial OK) |
| Profit | Optional `profitRecipient` (treasury vault) auto-forwards interest |

### Deploy

```bash
source .env
export TREASURY_VAULT=0x...   # membership + interest profit recipient
forge script script/DeployLoan.s.sol:DeployLoan \
  --rpc-url https://rpc.testnet.arc.network \
  --broadcast --legacy
```

Constructor: `(usdc, organizer, membershipVault)`.

### Flow

1. Organizer: `fundPool(amount)` (approve USDC first) — seed liquidity
2. Eligible member: `applyForLoan(principal, termMonths, purpose)` → Pending
3. Organizer / lending agent: `approveLoan(loanId)` → USDC disbursed
4. Anyone: `repay(loanId, amount)` → interest first, principal returns to pool

Set frontend: `VITE_LOAN_POOL_ADDRESS=0x...`

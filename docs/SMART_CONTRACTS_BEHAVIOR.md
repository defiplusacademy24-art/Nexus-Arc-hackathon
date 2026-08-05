# Nexusu Smart Contracts — Full Behavior Guide (Pre-Deploy)

| Field | Value |
| --- | --- |
| Network | Arc Testnet (chain ID `5042002`) |
| USDC ERC-20 | `0x3600000000000000000000000000000000000000` (6 decimals) |
| Solidity | `0.8.24` |
| Test suite | **79 tests** (all must pass before deploy) |
| Explorer | https://testnet.arcscan.app |

This document describes **exactly how every on-chain contract behaves**, how they connect, multi-workspace isolation rules, deploy order, and a pre-deploy checklist. Read this before broadcasting any new deployment.

---

## 1. Architecture overview

```text
                    ┌─────────────────────────────────────┐
                    │  Per cooperative workspace (app)    │
                    │  treasuryVaultAddress               │
                    │  loanPoolAddress                    │
                    └──────────────┬──────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│ Treasury Vault  │───►│ Loan Pool        │    │ Registry (optional) │
│ (holds deposits)│30% │ (lending USDC)   │    │ + RotationManager   │
│ 60% rotation    │    │ apply / approve  │    │ (metadata, order)   │
│ 5% emergency    │    │ edit / cancel    │    │                     │
│ 5% savings      │    │ repay            │    │                     │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
         ▲                         ▲
         │                         │
┌─────────────────┐    ┌──────────────────┐
│ Vault Factory   │    │ Loan Pool Factory│
│ createVault()   │    │ createPool()     │
└─────────────────┘    └──────────────────┘
```

### Critical product rule: multi-workspace isolation

| Asset | Scope |
| --- | --- |
| `CooperativeTreasuryVault` | **One instance per cooperative** |
| `CooperativeLoanPool` | **One instance per cooperative** (bound to that coop’s vault) |
| Member deposits, cycles, cooldowns | Per vault only |
| Loan liquidity & applications | Per pool only |
| App storage | `cooperative.treasuryVaultAddress` + `cooperative.loanPoolAddress` |

**Never** point two cooperatives at the same vault or the same loan pool. That caused:

- Balance from Coop A showing in Coop B  
- Deposit blocked in Coop B (`AlreadyContributed` / frequency cooldown)  
- Shared loan liquidity and applications across groups  

Legacy env vars `VITE_TREASURY_VAULT_ADDRESS` / `VITE_LOAN_POOL_ADDRESS` are single-coop only. Prefer factories.

---

## 2. Contract inventory

| Contract | File | Holds USDC? | Purpose |
| --- | --- | --- | --- |
| **CooperativeTreasuryVault** | `src/CooperativeTreasuryVault.sol` | **Yes** | Contributions, allocation, rotation payouts |
| **CooperativeTreasuryVaultFactory** | `src/CooperativeTreasuryVaultFactory.sol` | No | Deploys isolated vaults |
| **CooperativeLoanPool** | `src/CooperativeLoanPool.sol` | **Yes** | Lending capital, loans, repayments |
| **CooperativeLoanPoolFactory** | `src/CooperativeLoanPoolFactory.sol` | No | Deploys isolated pools |
| **CooperativeRegistry** | `src/CooperativeRegistry.sol` | No | On-chain coop metadata & membership |
| **RotationManager** | `src/RotationManager.sol` | No | Orchestrates payouts via vault |
| **MockUSDC** | `src/mocks/MockUSDC.sol` | Test only | Local tests |
| Interfaces | `src/interfaces/*` | No | Minimal ABIs for integration |

---

## 3. CooperativeTreasuryVault

### 3.1 Role

On-chain treasury for **one** cooperative. Holds member USDC contributions, splits each deposit across buckets, tracks per-cycle payment status, and pays rotation recipients from the rotation fund.

### 3.2 Constructor parameters

| Param | Meaning |
| --- | --- |
| `usdc_` | Arc USDC ERC-20 (6 decimals) |
| `organizer_` | Founder / admin (can set rules, register members, set lending pool) |
| `name_` | Human-readable coop name |
| `contributionAmount_` | **Exact** USDC per member per cycle (≥ `$10` = `10e6`) |
| `frequency_` | `0` Weekly · `1` BiWeekly · `2` Monthly |
| `strategy_` | Payout strategy (default JoinOrder) |
| `allocation_` | BPS for rotation / loan / emergency / savings (**must sum to 10_000**) |

### 3.3 Allocation (product default)

Applied on **every** successful deposit:

| Bucket | BPS | % | Behavior |
| --- | --- | --- | --- |
| Rotation fund | 6000 | 60% | Accumulates for cycle payout |
| Loan pool share | 3000 | 30% | If `lendingPool` set → transferred to loan pool via `fundPool`; else kept as vault accounting `loanPool` |
| Emergency reserve | 500 | 5% | Held in vault |
| Savings / investment | 500 | 5% | Remainder after rounding (absorbs dust) |

### 3.4 Membership

| Method | Who | Behavior |
| --- | --- | --- |
| `registerMember(address)` | Organizer | Assigns permanent 1-based `joinPosition` |
| `registerMembers(address[])` | Organizer | Batch register |
| `joinVault()` | Anyone | Self-register (Circle / app wallets) |
| `deposit()` | Anyone | **Auto-joins** caller if not yet a member |
| `setMemberActive(address, bool)` | Organizer | Deactivate / reactivate |

Join positions are permanent for JoinOrder / OrganizerAssigned strategies.

### 3.5 Deposit rules (`deposit` / `depositFor`)

1. Member must be active (or auto-joined).  
2. Current cycle must not be already paid out.  
3. Member must not have contributed this cycle (`hasContributed`).  
4. Member must not be exempt this cycle.  
5. **Frequency cooldown**: if they deposited before, `block.timestamp >= lastContributedAt + period`  
   - Weekly = 7 days · BiWeekly = 14 days · Monthly = 30 days  
6. Pulls **exact** `contributionAmount` USDC (never more, never less).  
7. Allocates BPS; routes loan share; emits `ContributionDeposited`.  

**Views for UX:**

- `canDeposit(member)` → `(ok, reason)`  
- `nextContributionAt(member)`  
- `requiredContribution()` / `contributionAmount`  
- `getContributionStatus(member)` → Waiting / Paid / Exempt  

### 3.6 Cycle & payout (`triggerPayout`)

1. All non-exempt **active** members must have paid this cycle.  
2. Only the **current payout recipient** may call (queue head by strategy).  
3. Pays `cycleRotationAccumulated[cycle]` from `rotationFund` to recipient.  
4. Marks cycle complete; advances `currentCycle` and recipient position.  
5. One payout per cycle only.  

**Views:**

- `canTriggerPayout()` — pot ready (all paid)  
- `canClaimPayout(account)` — ready **and** account is recipient  
- `getCurrentPayoutRecipient()` / `getNextPayoutRecipient()`  
- `getTreasuryBalance()` / `getTreasuryAllocationBreakdown()`  

### 3.7 Payout strategies

| Strategy | Recipient resolution |
| --- | --- |
| **JoinOrder** (default) | Permanent join positions #1 → #2 → … → wrap; skips inactive |
| **OrganizerAssigned** | `organizerNextRecipient` if set & active; else join order |
| **RandomDraw** | Pseudo-random among active (prevrandao + timestamp + cycle; **not VRF**) |
| **GovernanceVote** | Highest vote count this cycle (`castPayoutVote`) |

### 3.8 Organizer admin (selected)

| Function | Notes |
| --- | --- |
| `setContributionRules(amount, frequency)` | Only when **no one has paid** current cycle |
| `setAllocation` | BPS must sum 10_000 |
| `setPayoutStrategy` | Switch strategy |
| `setMemberExempt(member, cycle, exempt)` | Exempts from contribution requirement |
| `setLendingPool(pool)` | Enables 30% auto-forward on deposit |
| `pushLoanAllocationToPool()` | Moves residual vault `loanPool` USDC into `lendingPool` |
| `transferOrganizer` | Hand off organizer role |

### 3.9 Security properties

- `ReentrancyGuard` on deposit / payout / push loan  
- OpenZeppelin `SafeERC20`  
- Exact contribution amount (no over/under pay)  
- One contribution per member per cycle  
- One payout per cycle  
- Inactive members skipped for payout eligibility  

### 3.10 What this contract does **not** do

- Does not know about other cooperatives (no `coopId` inside vault).  
- Does not hold “app workspace” IDs — isolation = **separate deployments**.  
- Does not approve loans (loan pool does).  
- Does not register itself on CooperativeRegistry (app/registry do that).  

---

## 4. CooperativeTreasuryVaultFactory

### 4.1 Role

Deploys a **new** `CooperativeTreasuryVault` per cooperative so workspaces never share state.

### 4.2 Constructor

- `usdc_` — fixed USDC for all vaults created by this factory  

### 4.3 `createVault(...)`

| Param | Meaning |
| --- | --- |
| `organizer_` | Usually platform operator key (membership bootstrap) |
| `name_` | Coop name stored on vault |
| `contributionAmount_` | ≥ `10e6` ($10) |
| `frequency_` | 0 / 1 / 2 |
| `appCoopIdHash_` | `keccak256(appCoopId)` for indexing; `bytes32(0)` skips index |

**Behavior:**

- Default allocation 60/30/5/5  
- Strategy = JoinOrder  
- Emits `VaultCreated`  
- Indexes `vaultByAppCoopId[hash]` (reverts if hash already used)  
- Appends to `allVaults`  

**Does not:**

- Auto-register members  
- Wire loan pool (loan factory + `setLendingPool` do that)  

### 4.4 Views

- `vaultCount()`, `allVaults(i)`, `getVaults(offset, limit)`, `vaultByAppCoopId(hash)`  

---

## 5. CooperativeLoanPool

### 5.1 Role

On-chain lending for **one** cooperative. Holds loan-capital USDC (from vault 30% forwards and optional organizer top-ups). Members apply; organizer/agent approves; borrowers repay.

### 5.2 Constructor

| Param | Meaning |
| --- | --- |
| `usdc_` | Arc USDC |
| `organizer_` | Approver / admin |
| `membershipVault_` | Optional treasury vault; if set, only `vault.isMember` may apply |

### 5.3 Funding

| Path | Who | Behavior |
| --- | --- | --- |
| Auto (production) | Vault on each deposit | Vault calls `fundPool(loanShare)` after approve |
| Manual | Organizer | `fundPool(amount)` with prior USDC approve |
| Residual push | Vault organizer | `vault.pushLoanAllocationToPool()` |

`fundPool` only accepts:

- `msg.sender == organizer`, **or**  
- `msg.sender == membershipVault` (vault auto-forward)  

**Liquidity:**

```text
availableLiquidity = USDC.balanceOf(pool) − interestEarned (reserved profit)
```

Outstanding principal is already paid out to borrowers (not in contract balance).

### 5.4 Eligibility

- If `membershipVault != 0`: must be active member on **that** vault  
- Else: local `registerBorrower` allowlist  

One **open** loan per borrower at a time (Pending / Active / Defaulted blocks new apply).

### 5.5 Loan lifecycle

```text
applyForLoan ──► Pending
    │
    ├─ updateApplication (borrower only) ── stays Pending
    ├─ cancelApplication (borrower) ──► Rejected (clears open loan)
    ├─ rejectLoan (organizer/agent) ──► Rejected
    └─ approveLoan (organizer/agent) ──► Active (USDC disbursed)
              │
              ├─ repay ──► Active until fully paid ──► Completed
              └─ markDefaulted (organizer, after due) ──► Defaulted (still repayable)
```

#### Apply (`applyForLoan`)

- Params: principal (6 dec), termMonths 1–6, purpose string  
- Interest from table (simple interest on full term):  

| Term (months) | Interest |
| --- | --- |
| 1 | 5% (500 bps) |
| 2 | 6% |
| 3 | 7% |
| 4 | 8% |
| 5 | 9% |
| 6 | 10% |

- `totalDue = principal + interest`  
- No funds move until approval  

#### Edit (`updateApplication`)

- Borrower only, while **Pending**  
- Can change principal, term, purpose (recalculates interest)  

#### Cancel (`cancelApplication`)

- Borrower only, while **Pending**  
- Status → `Rejected` (same enum value as organizer reject; UI may distinguish via event)  
- Clears `openLoanId` so they can apply again  

#### Approve (`approveLoan`)

- Organizer or `lendingAgent`  
- Requires `availableLiquidity >= principal`  
- Principal ≤ `maxLoanBps` of liquidity (default **2500 = 25%**)  
- Transfers USDC to borrower; sets due date ≈ term × 30 days  

#### Repay (`repay`)

- Anyone may pay (borrower or sponsor)  
- Interest first, then principal  
- Principal returns to pool liquidity; interest → `interestEarned`  
- If `profitRecipient` set, interest is auto-forwarded there  

### 5.6 Views (Loans page)

| View | Use |
| --- | --- |
| `availableLiquidity()` | “USDC available to lend” |
| `getPoolStats()` | balance, liquidity, outstanding, interest, loan count |
| `canApply(account)` | eligibility + open loan check |
| `quoteLoan(principal, term)` | Interest preview |
| `getLoan(id)` / `remainingBalance` | Detail / repay UI |
| `openLoanId(borrower)` | Pending/active id |

### 5.7 Security properties

- ReentrancyGuard on fund / apply / approve / repay  
- SafeERC20  
- Max single-loan share of liquidity  
- Membership gate via vault when wired  
- One open loan per borrower  

### 5.8 What this contract does **not** do

- Does not pull the 30% itself — vault pushes on deposit  
- Does not enforce multi-coop isolation without separate deployments  
- Does not custody Circle keys  

---

## 6. CooperativeLoanPoolFactory

### 6.1 Role

Deploys a **new** loan pool per cooperative, bound to that coop’s treasury vault.

### 6.2 `createPool(organizer, membershipVault, profitRecipient, appCoopIdHash)`

**Behavior:**

1. Reverts if `appCoopIdHash` already has a pool  
2. Reverts if `membershipVault` already has a pool  
3. Deploys pool with factory as temporary organizer  
4. Sets `profitRecipient` (typically the vault)  
5. Transfers organizer to `organizer_` (platform operator)  
6. Indexes `poolByAppCoopId` and `poolByMembershipVault`  
7. Emits `PoolCreated`  

### 6.3 Required follow-up (operator / app)

After createPool, **must** call on the vault (vault organizer):

```text
vault.setLendingPool(poolAddress)
```

Without this, the 30% loan share stays inside vault accounting (`loanPool` residual) and is **not** available for members to borrow on the Loans page.

Optional: `vault.pushLoanAllocationToPool()` if residual loan share already exists.

### 6.4 Standard provision order (production)

```text
1. vaultFactory.createVault(operator, name, amount, freq, coopHash)
2. loanPoolFactory.createPool(operator, vault, vault, coopHash)
3. vault.setLendingPool(pool)          // 30% auto-forward
4. Store vault + pool addresses on cooperative record
5. Member joinVault / deposit / applyForLoan
```

The API `provisionCoopOnchainInfrastructure` performs steps 1–4 when factories + operator key are configured.

---

## 7. CooperativeRegistry

### 7.1 Role

On-chain **directory** of cooperatives: metadata, members, join order, scores. **Does not hold funds.**

Each registry cooperative points at:

- `treasuryVault` address  
- `loanPool` address  

### 7.2 Create cooperative

`createCooperative(name, description, treasuryVault, loanPool, contributionAmount, frequency, maxMembers, strategy, organizerDisplayName)`

- Assigns sequential `coopId`  
- Organizer auto-joined as position #1  
- Status Active  

### 7.3 Membership

- `joinCooperative` / `leaveCooperative` (leave marks inactive; position reserved)  
- Permanent join positions for JoinOrder  
- Scores: governance / credit (0–1000); loan eligibility heuristics  

### 7.4 Rotation hooks

- `RotationManager` may advance rotation index and recipient flags  
- Registry rotation state is **planning/metadata**; vault has its own payout queue unless kept in sync  

### 7.5 Relationship to app

Current Nexusu app primarily stores coops in **Postgres/file** and provisions vaults/pools via factories. Registry is available for full on-chain membership and agents; wiring both is optional for MVP but recommended for production consistency.

---

## 8. RotationManager

### 8.1 Role

Orchestrates rotation payouts. **Does not hold USDC.**

Typical flow:

1. Ensure vault pot ready  
2. Call `vault.triggerPayout()` (or coordinate recipient claim)  
3. Advance registry rotation state  
4. Record history  

### 8.2 Notes

- Bound to a `CooperativeRegistry` at construction  
- Organizer may skip recipients on the registry side  
- Vault payout rules remain authoritative for who receives funds  

---

## 9. Interfaces & mock

| Item | Behavior |
| --- | --- |
| `ICooperativeTreasuryVault` | Minimal vault surface for RotationManager |
| `ICooperativeRegistry` | Registry surface for agents / integrations |
| `MockUSDC` | Mintable ERC-20 for Foundry tests only — **never deploy as production USDC** |

---

## 10. Money flow (end-to-end, one cooperative)

```text
Member USDC wallet
       │
       │ approve + deposit()
       ▼
Treasury Vault
       │
       ├── 60% → rotationFund ──(when all paid + recipient claims)──► Member payout
       ├── 30% → fundPool() ──► Loan Pool ──(approve)──► Borrower
       │                              ▲                      │
       │                              │         repay (interest then principal)
       │                              └──────────────────────┘
       ├── 5%  → emergencyReserve (stays in vault)
       └── 5%  → savingsInvestment (stays in vault)

Interest on loans → interestEarned → optional profitRecipient (usually vault)
```

### Cross-cooperative isolation (must hold after deploy)

| Action in Coop A | Visible in Coop B? |
| --- | --- |
| Deposit $100 | **No** — B vault balance unchanged |
| 30% ($30) in A’s loan pool | **No** — B pool liquidity unchanged |
| Loan application | **No** — B does not list A’s apps |
| Frequency / cycle paid flag | **No** — independent state |

Proven by:

- `MultiWorkspaceIsolationTest` (vault)  
- `MultiWorkspaceLoanIsolationTest` (loan + 30% wiring)  

---

## 11. Roles cheat sheet

| Role | Vault | Loan pool | Registry |
| --- | --- | --- | --- |
| **Organizer** (often operator key on deploy) | Rules, register, setLendingPool, exempts | Approve/reject, fund, register borrowers, max loan bps | Create settings, scores |
| **Member / borrower** | joinVault, deposit, claim payout if head | apply, update, cancel, repay | join / leave |
| **Lending agent** (optional) | — | Approve/reject only | — |
| **Platform admin** (registry) | — | — | pause, set RotationManager |
| **App backend (operator key)** | Deploy via factory, bootstrap registerMember | Deploy pool, setLendingPool | Optional |

**Circle wallets:** Member addresses are Circle smart accounts, not the forge deploy key. Production path:

1. Operator stays vault/pool organizer  
2. Members `joinVault()` or deposit auto-join  
3. Operator can `registerMember` if joinVault unavailable  

---

## 12. Deploy scripts (Foundry)

| Script | Deploys | Output env |
| --- | --- | --- |
| `script/DeployFactory.s.sol` | Vault factory | `TREASURY_VAULT_FACTORY_ADDRESS` |
| `script/DeployLoanFactory.s.sol` | Loan pool factory | `LOAN_POOL_FACTORY_ADDRESS` |
| `script/Deploy.s.sol` | **One** vault (legacy single-coop) | `VITE_TREASURY_VAULT_ADDRESS` |
| `script/DeployLoan.s.sol` | **One** pool + optional wire to one vault | `VITE_LOAN_POOL_ADDRESS` |
| `script/DeployRegistry.s.sol` | Registry + RotationManager | `VITE_COOPERATIVE_REGISTRY_ADDRESS`, rotation manager |
| `script/BootstrapCircleFounder.s.sol` | Helper for Circle founder bootstrap | — |

### Recommended deploy order (multi-workspace)

```bash
cd contracts
# Fund PRIVATE_KEY with Arc testnet gas (USDC native) + have USDC ERC-20 for tests

# 1. Vault factory
forge script script/DeployFactory.s.sol:DeployFactory \
  --rpc-url https://rpc.testnet.arc.network --broadcast --legacy

# 2. Loan pool factory
forge script script/DeployLoanFactory.s.sol:DeployLoanFactory \
  --rpc-url https://rpc.testnet.arc.network --broadcast --legacy

# 3. (Optional) Registry + RotationManager
forge script script/DeployRegistry.s.sol:DeployRegistry \
  --rpc-url https://rpc.testnet.arc.network --broadcast --legacy
```

Then set server env:

```text
TREASURY_VAULT_FACTORY_ADDRESS=0x...
LOAN_POOL_FACTORY_ADDRESS=0x...
VAULT_OPERATOR_PRIVATE_KEY=0x...   # same key used to deploy; funded for gas
ARC_RPC_URL=https://rpc.testnet.arc.network
```

Frontend:

```text
VITE_TREASURY_VAULT_FACTORY_ADDRESS=0x...
VITE_LOAN_POOL_FACTORY_ADDRESS=0x...
```

**Do not** set shared `VITE_TREASURY_VAULT_ADDRESS` / `VITE_LOAN_POOL_ADDRESS` for multi-coop production.

Per-coop addresses are created at cooperative create / `POST /api/cooperatives/:id/vault` and stored as:

- `treasuryVaultAddress`  
- `loanPoolAddress`  

---

## 13. Pre-deploy verification checklist

### Local (required)

```bash
cd contracts
forge build
forge test -vv
```

Expect **79 passed**, including:

| Suite | What it proves |
| --- | --- |
| CooperativeTreasuryVaultTest | Deposits, exact amount, frequency, payout, auto-join |
| CooperativeLoanPoolTest | Apply, approve, repay, cancel, update, max loan |
| CooperativeRegistryTest | Create, join, leave, rotation hooks |
| IntegrationTest | Vault + loan membership + exact contribution |
| MultiWorkspaceIsolationTest | Vaults don’t share balances/cycles |
| MultiWorkspaceLoanIsolationTest | 30% only funds matching pool; apps isolated |

### On-chain smoke (after deploy)

1. **Provision** coop A and coop B (two vaults + two pools).  
2. Confirm addresses differ on Arcscan.  
3. Deposit as user in **A only**.  
4. Check A vault balance and A pool liquidity ≈ 30% of deposit.  
5. Open B treasury/loans — balances **0**, no A history.  
6. Deposit in B — succeeds (not blocked by A’s cycle).  
7. Apply for loan in A using A’s liquidity; cancel/edit while pending.  
8. Confirm B cannot apply against A’s pool (not a member of A’s vault).  

### Config smoke

- [ ] Operator key is vault organizer on factory-created vaults  
- [ ] `vault.lendingPool()` equals that coop’s pool  
- [ ] App shows pool liquidity after first deposit (not residual-only)  
- [ ] Edit / Cancel appear for **own** pending loans  
- [ ] Second workspace never shows first workspace treasury  

---

## 14. Known limitations & design notes

| Topic | Behavior / risk |
| --- | --- |
| Cancel vs reject | Both set status `Rejected` on-chain; cancel emits `LoanCancelled` |
| RandomDraw entropy | Not VRF — acceptable for testnet / MVP |
| Due dates | Term × 30 days approximation |
| Max loan | Default 25% of **available liquidity** at approval time |
| Registry vs vault membership | Can diverge if only one path is used — prefer vault membership for funds |
| Operator as organizer | Needed for Circle bootstrap; founders use app as members |
| Gas / factory | Each new coop costs createVault + createPool + setLendingPool txs |
| Legacy single vault/pool | Still deployable via Deploy.s.sol / DeployLoan.s.sol — **unsafe for multi-coop** |
| Mainnet | Do **not** put mainnet private keys in `VAULT_OPERATOR_PRIVATE_KEY` for this MVP pattern |

---

## 15. Events reference (integration / indexers)

### Vault (selected)

- `MemberRegistered`, `ContributionDeposited`, `PayoutExecuted`, `CycleCompleted`  
- `ContributionRulesUpdated`, `LendingPoolUpdated`, `LoanShareForwarded`, `LoanAllocationPushed`  

### Loan pool (selected)

- `PoolFunded`, `LoanApplied`, `LoanUpdated`, `LoanCancelled`  
- `LoanApproved`, `LoanRejected`, `LoanRepaid`, `LoanDefaulted`  
- `InterestWithdrawn`, `MembershipVaultUpdated`  

### Factories

- `VaultCreated(vault, organizer, name, amount, frequency, appCoopIdHash)`  
- `PoolCreated(pool, organizer, membershipVault, profitRecipient, appCoopIdHash)`  

### Registry / RotationManager

- `CooperativeCreated`, `MemberJoined`, `MemberLeft`, `RotationIndexAdvanced`  
- `RotationExecuted`, `RecipientSkipped`, `CycleCompleted`  

---

## 16. Error catalog (user-facing mapping)

| On-chain error | Typical UX message |
| --- | --- |
| `AlreadyContributed` | Already contributed this cycle |
| `ContributionTooEarly` | Wait for next weekly/bi-weekly/monthly window |
| `AmountBelowMinimum` / `InvalidAmount` | Contribution ≥ $10; exact founder amount only |
| `ContributionsIncomplete` | Payout locked until all members paid |
| `NotPayoutRecipient` | Only current queue head can claim |
| `NotEligibleBorrower` | Join vault / not a member of this coop’s vault |
| `HasOpenLoan` | Finish, cancel, or repay open loan first |
| `InsufficientLiquidity` | Pool needs more USDC (deposits or fund) |
| `ExceedsMaxLoan` | Request ≤ max % of liquidity (default 25%) |
| `BadStatus` | Wrong loan state for this action |
| `NotOrganizer` / `NotApprover` | Admin-only action |
| `CoopIdAlreadyHasVault` / `CoopIdAlreadyHasPool` | Idempotent factory index — already provisioned |
| `VaultAlreadyHasPool` | One pool per membership vault |

---

## 17. File map

```text
contracts/
  src/
    CooperativeTreasuryVault.sol
    CooperativeTreasuryVaultFactory.sol
    CooperativeLoanPool.sol
    CooperativeLoanPoolFactory.sol
    CooperativeRegistry.sol
    RotationManager.sol
    interfaces/
    mocks/MockUSDC.sol
  script/
    DeployFactory.s.sol
    DeployLoanFactory.s.sol
    Deploy.s.sol
    DeployLoan.s.sol
    DeployRegistry.s.sol
    BootstrapCircleFounder.s.sol
  test/
    CooperativeTreasuryVault.t.sol
    CooperativeLoanPool.t.sol
    CooperativeRegistry.t.sol
    Integration.t.sol
    MultiWorkspaceIsolation.t.sol
    MultiWorkspaceLoanIsolation.t.sol
```

---

## 18. Related docs

- [PRODUCT.md](./PRODUCT.md) — product overview  
- [AGENT_AND_CIRCLE_WALLET_SETUP.md](./AGENT_AND_CIRCLE_WALLET_SETUP.md) — Circle + agents  
- [contracts/README.md](../contracts/README.md) — Foundry quick start  

---

## 19. Bottom line before you deploy

1. Run **`forge test`** — all 79 green.  
2. Deploy **factories**, not one shared vault/pool (unless truly single-coop demo).  
3. Every cooperative must store **its own** vault + pool addresses.  
4. Always **`setLendingPool`** so 30% deposits fund **that** pool.  
5. Smoke-test **two workspaces** for isolation before announcing multi-coop support.  

If those five hold, the contracts behave as designed for multi-cooperative Nexusu on Arc Testnet.

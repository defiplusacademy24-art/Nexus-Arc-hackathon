/**
 * On-chain CooperativeTreasuryVault client (Arc Testnet).
 *
 * Reads: public RPC via viem.
 * Writes:
 *  - Circle email/PIN wallets → ucWrite (backend challenge)
 *  - Injected EOA (MetaMask etc.) → eth_sendTransaction via window.ethereum
 */

import {
  createPublicClient,
  encodeFunctionData,
  formatUnits,
  parseUnits,
  type Address,
  type Hex,
} from 'viem';
import { arcTestnet } from 'viem/chains';
import {
  ARC_EXPLORER_URL,
  ARC_USDC_ERC20_ADDRESS,
  ARC_TESTNET_CHAIN_ID,
  createArcTransport,
} from '@/config/arc';
import {
  TREASURY_VAULT_ADDRESS,
  TREASURY_USDC_ADDRESS,
  treasuryVaultAbi,
  erc20ApproveAbi,
  MIN_CONTRIBUTION_USDC,
} from '@/config/treasury-vault';
import {
  loadStoredUcSession,
  ucWrite,
  type UcSession,
} from '@/services/circle/userWallet';
import { ensureArcTestnet, getInjectedProvider } from '@/services/wallet/arc-network';
import type { ContributionFrequency } from '@/types';

export type VaultBreakdown = {
  totalBalance: number;
  rotationFund: number;
  loanPool: number;
  emergencyReserve: number;
  savingsInvestment: number;
};

export type OnChainFrequency = ContributionFrequency;

export type VaultSnapshot = {
  configured: boolean;
  vaultAddress: Address | null;
  totalBalance: number;
  contributionAmount: number;
  contributionAmountRaw: bigint;
  contributionFrequency: OnChainFrequency | null;
  currentCycle: number;
  currentRecipient: Address | null;
  currentPosition: number;
  nextRecipient: Address | null;
  nextPosition: number;
  isMember: boolean;
  isOrganizer: boolean;
  organizer: Address | null;
  contributionStatus: 'waiting' | 'paid' | 'exempt' | 'unknown';
  canPayout: boolean;
  paidCount: number;
  requiredCount: number;
  breakdown: VaultBreakdown | null;
  joinPosition: number | null;
  /** Earliest unix time member may deposit again (0 = never deposited / unknown). */
  nextContributionAt: number | null;
  canDepositNow: boolean | null;
  canDepositReason: string | null;
  periodSeconds: number | null;
};

const STATUS_MAP = ['waiting', 'paid', 'exempt'] as const;

/** Map app frequency labels ↔ on-chain enum (0=Weekly, 1=BiWeekly, 2=Monthly). */
export function frequencyToOnChain(freq: ContributionFrequency | string): number {
  switch (freq) {
    case 'weekly':
      return 0;
    case 'bi-weekly':
      return 1;
    case 'monthly':
    default:
      return 2;
  }
}

export function frequencyFromOnChain(raw: number): OnChainFrequency {
  if (raw === 0) return 'weekly';
  if (raw === 1) return 'bi-weekly';
  return 'monthly';
}

export function formatFrequencyLabel(freq: ContributionFrequency | string | null | undefined): string {
  switch (freq) {
    case 'weekly':
      return 'Weekly';
    case 'bi-weekly':
      return 'Bi-weekly';
    case 'monthly':
      return 'Monthly';
    default:
      return '—';
  }
}

export function isVaultConfigured(): boolean {
  return Boolean(TREASURY_VAULT_ADDRESS && /^0x[a-fA-F0-9]{40}$/.test(TREASURY_VAULT_ADDRESS));
}

export function getVaultAddress(): Address | null {
  if (!isVaultConfigured()) return null;
  return TREASURY_VAULT_ADDRESS as Address;
}

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: createArcTransport(),
});

function usdcToNumber(raw: bigint): number {
  return Number(formatUnits(raw, 6));
}

export function usdcToRaw(amount: number): bigint {
  return parseUnits(String(amount), 6);
}

/** Soften noisy viem/RPC errors for the UI. */
export function friendlyVaultError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  // Short messages + full viem dumps ("RPC Request failed … Details: request limit reached")
  if (
    /request limit reached|rate limit|429|too many requests/i.test(msg) ||
    (/RPC Request failed/i.test(msg) && /limit|429/i.test(msg))
  ) {
    return 'Arc public RPC is busy. Wait 10–15 seconds, then try again. (Your deposit may still complete — check Arc explorer.)';
  }
  if (/NotMember|not a member|Not registered/i.test(msg)) {
    return 'Could not join the vault automatically. Try again, or redeploy the vault with joinVault support.';
  }
  if (/AlreadyContributed|already contributed/i.test(msg)) {
    return 'You already contributed this cycle.';
  }
  if (/ContributionTooEarly|too_early_for_frequency|too early/i.test(msg)) {
    return 'Too early to contribute again. Wait until the next weekly / bi-weekly / monthly window set by the founder.';
  }
  if (/AmountBelowMinimum|below minimum/i.test(msg)) {
    return `Contribution must be at least $${MIN_CONTRIBUTION_USDC}.`;
  }
  if (/NotOrganizer|not organizer/i.test(msg)) {
    return 'Only the vault organizer (founder) can update contribution rules.';
  }
  if (/API parameter invalid|parameter invalid|invalid parameter/i.test(msg)) {
    return 'Wallet service rejected the request (bad parameters). Redeploy the latest app and try Deposit again.';
  }
  if (/user rejected|denied|rejected the request/i.test(msg)) {
    return 'Transaction was cancelled in the wallet.';
  }
  if (/Failed to fetch|network|timeout|ECONNREFUSED/i.test(msg)) {
    return 'Network error talking to Arc. Check your connection and try again.';
  }
  // Truncate giant raw RPC dumps
  if (msg.length > 220) {
    return `${msg.slice(0, 200)}…`;
  }
  return msg;
}

function emptySnapshot(): VaultSnapshot {
  return {
    configured: false,
    vaultAddress: null,
    totalBalance: 0,
    contributionAmount: 0,
    contributionAmountRaw: 0n,
    contributionFrequency: null,
    currentCycle: 0,
    currentRecipient: null,
    currentPosition: 0,
    nextRecipient: null,
    nextPosition: 0,
    isMember: false,
    isOrganizer: false,
    organizer: null,
    contributionStatus: 'unknown',
    canPayout: false,
    paidCount: 0,
    requiredCount: 0,
    breakdown: null,
    joinPosition: null,
    nextContributionAt: null,
    canDepositNow: null,
    canDepositReason: null,
    periodSeconds: null,
  };
}

function resultValue<T>(r: { status: 'success' | 'failure'; result?: unknown }): T | null {
  if (r.status !== 'success') return null;
  return r.result as T;
}

/**
 * Load vault state with as few RPC requests as possible.
 * Arc public RPC rate-limits burst eth_call traffic, so we multicall core reads.
 */
export async function fetchVaultSnapshot(wallet?: string | null): Promise<VaultSnapshot> {
  const vault = getVaultAddress();
  if (!vault) return emptySnapshot();

  const account = wallet && /^0x[a-fA-F0-9]{40}$/i.test(wallet) ? (wallet as Address) : null;

  // Minimal multicall — fewer eth_calls = fewer rate limits on public Arc RPC
  const core = await publicClient.multicall({
    allowFailure: true,
    contracts: [
      { address: vault, abi: treasuryVaultAbi, functionName: 'getTreasuryBalance' },
      { address: vault, abi: treasuryVaultAbi, functionName: 'contributionAmount' },
      { address: vault, abi: treasuryVaultAbi, functionName: 'currentCycle' },
      { address: vault, abi: treasuryVaultAbi, functionName: 'canTriggerPayout' },
      { address: vault, abi: treasuryVaultAbi, functionName: 'organizer' },
      { address: vault, abi: treasuryVaultAbi, functionName: 'contributionFrequency' },
      { address: vault, abi: treasuryVaultAbi, functionName: 'contributionPeriodSeconds' },
    ],
  });

  const balRaw = resultValue<bigint>(core[0]);
  const contribRaw = resultValue<bigint>(core[1]);
  const cycle = resultValue<number | bigint>(core[2]);
  const canPay = resultValue<readonly [boolean, number, number]>(core[3]);
  const organizerRaw = resultValue<Address>(core[4]);
  const freqRaw = resultValue<number | bigint>(core[5]);
  const periodRaw = resultValue<bigint | number>(core[6]);

  // If core amount failed entirely, surface a soft rate-limit style failure upstream
  if (contribRaw == null && balRaw == null) {
    throw new Error('request limit reached');
  }

  const contributionFrequency: OnChainFrequency | null =
    freqRaw != null ? frequencyFromOnChain(Number(freqRaw)) : null;
  const periodSeconds = periodRaw != null ? Number(periodRaw) : null;

  let isMember = false;
  let contributionStatus: VaultSnapshot['contributionStatus'] = 'unknown';
  let joinPosition: number | null = null;
  let nextContributionAt: number | null = null;
  let canDepositNow: boolean | null = null;
  let canDepositReason: string | null = null;
  const organizer = organizerRaw ?? null;
  const isOrganizer = Boolean(
    account && organizer && account.toLowerCase() === organizer.toLowerCase(),
  );

  if (account) {
    try {
      // One small multicall for wallet-specific state only
      const memberCore = await publicClient.multicall({
        allowFailure: true,
        contracts: [
          {
            address: vault,
            abi: treasuryVaultAbi,
            functionName: 'isMember',
            args: [account],
          },
          {
            address: vault,
            abi: treasuryVaultAbi,
            functionName: 'getContributionStatus',
            args: [account],
          },
          {
            address: vault,
            abi: treasuryVaultAbi,
            functionName: 'canDeposit',
            args: [account],
          },
          {
            address: vault,
            abi: treasuryVaultAbi,
            functionName: 'nextContributionAt',
            args: [account],
          },
        ],
      });

      isMember = Boolean(resultValue<boolean>(memberCore[0]));
      if (isMember) {
        const status = resultValue<number | bigint>(memberCore[1]);
        if (status != null) {
          contributionStatus = STATUS_MAP[Number(status)] ?? 'unknown';
        }
        const can = resultValue<readonly [boolean, string]>(memberCore[2]);
        if (can) {
          canDepositNow = Boolean(can[0]);
          canDepositReason = can[1] || null;
        }
        const nextAt = resultValue<number | bigint>(memberCore[3]);
        nextContributionAt = nextAt != null && Number(nextAt) > 0 ? Number(nextAt) : null;
      } else {
        // Not registered yet — still allow deposit attempt (auto-join / bootstrap)
        canDepositNow = true;
      }
    } catch {
      /* member views optional when RPC is throttled */
      canDepositNow = true;
    }
  }

  const [ready, required, paid] = canPay ?? [false, 0, 0];

  return {
    configured: true,
    vaultAddress: vault,
    totalBalance: balRaw != null ? usdcToNumber(balRaw) : 0,
    contributionAmount: contribRaw != null ? usdcToNumber(contribRaw) : 0,
    contributionAmountRaw: contribRaw ?? 0n,
    contributionFrequency,
    currentCycle: cycle != null ? Number(cycle) : 0,
    currentRecipient: null,
    currentPosition: 0,
    nextRecipient: null,
    nextPosition: 0,
    isMember,
    isOrganizer,
    organizer,
    contributionStatus,
    canPayout: Boolean(ready),
    paidCount: Number(paid),
    requiredCount: Number(required),
    breakdown: null,
    joinPosition,
    nextContributionAt,
    canDepositNow,
    canDepositReason,
    periodSeconds,
  };
}

async function writeContract(params: {
  contractAddress: Address;
  callData?: Hex;
  abiFunctionSignature?: string;
  abiParameters?: unknown[];
  refId?: string;
  ucSession?: UcSession | null;
  waitForTx?: boolean;
}): Promise<{ txHash: string | null }> {
  const session = params.ucSession ?? loadStoredUcSession();
  if (session) {
    // Circle: callData and abiFunctionSignature are mutually exclusive
    if (params.abiFunctionSignature) {
      return ucWrite(session, {
        contractAddress: params.contractAddress,
        abiFunctionSignature: params.abiFunctionSignature,
        abiParameters: params.abiParameters,
        refId: params.refId,
        waitForTx: params.waitForTx,
      });
    }
    if (!params.callData) throw new Error('callData required');
    return ucWrite(session, {
      contractAddress: params.contractAddress,
      callData: params.callData,
      refId: params.refId,
      waitForTx: params.waitForTx,
    });
  }

  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error(
      'No signing wallet available. Sign in with Circle email or connect an injected wallet on Arc Testnet.',
    );
  }

  let data = params.callData;
  if (!data && params.abiFunctionSignature) {
    // injected path still needs raw calldata
    throw new Error('Injected wallet path requires callData');
  }
  if (!data) throw new Error('callData required');

  await ensureArcTestnet(provider);
  const accounts = (await provider.request({
    method: 'eth_requestAccounts',
  })) as string[];
  const from = accounts[0];
  if (!from) throw new Error('No account selected in the wallet');

  const txHash = (await provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from,
        to: params.contractAddress,
        data,
        chainId: `0x${ARC_TESTNET_CHAIN_ID.toString(16)}`,
      },
    ],
  })) as string;

  // Wait for inclusion so we never report success without a receipt
  if (params.waitForTx !== false && txHash) {
    for (let i = 0; i < 40; i++) {
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash as Hex }).catch(() => null);
      if (receipt) {
        if (receipt.status === 'reverted') {
          throw new Error(`Transaction reverted on Arc: ${txHash}`);
        }
        return { txHash };
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return { txHash: txHash ?? null };
}

async function sleepMs(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/** Wait until ERC-20 allowance for vault ≥ amount (approve confirmed on Arc). */
async function waitForAllowance(
  usdc: Address,
  owner: Address,
  spender: Address,
  minAmount: bigint,
  timeoutMs = 90_000,
): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const allowance = (await publicClient.readContract({
        address: usdc,
        abi: erc20ApproveAbi,
        functionName: 'allowance',
        args: [owner, spender],
      })) as bigint;
      if (allowance >= minAmount) return true;
    } catch {
      /* rate limit */
    }
    await sleepMs(4_000);
  }
  return false;
}

/** Wait until contribution status is Paid for this wallet (true on-chain deposit). */
async function waitForContributionPaid(
  vault: Address,
  member: Address,
  timeoutMs = 120_000,
): Promise<boolean> {
  const started = Date.now();
  // Sparse polls — public Arc RPC rate-limits burst eth_call
  while (Date.now() - started < timeoutMs) {
    try {
      const status = (await publicClient.readContract({
        address: vault,
        abi: treasuryVaultAbi,
        functionName: 'getContributionStatus',
        args: [member],
      })) as number;
      // 0=waiting 1=paid 2=exempt
      if (Number(status) === 1) return true;
    } catch {
      /* rpc blip / rate limit — wait longer */
      await sleepMs(4_000);
      continue;
    }
    await sleepMs(4_000);
  }
  return false;
}

/**
 * Silently ensure the wallet can deposit: joinVault (new contracts), else server
 * bootstrap (deploy-key operator for older vaults). Create/join coop callers use
 * this so users never see a separate "register on vault" step.
 */
export async function ensureVaultMembership(
  wallet?: string | null,
  opts?: { claimOrganizer?: boolean; ucSession?: UcSession | null },
): Promise<'already' | 'joined' | 'bootstrapped' | 'skipped'> {
  const vault = getVaultAddress();
  if (!vault || !wallet || !/^0x[a-fA-F0-9]{40}$/i.test(wallet)) return 'skipped';

  const account = wallet as Address;
  try {
    const isMember = (await publicClient.readContract({
      address: vault,
      abi: treasuryVaultAbi,
      functionName: 'isMember',
      args: [account],
    })) as boolean;
    if (isMember) return 'already';
  } catch {
    /* RPC blip — still try join paths */
  }

  // 1) Self-join on vaults that expose joinVault()
  try {
    const callData = encodeFunctionData({
      abi: treasuryVaultAbi,
      functionName: 'joinVault',
    });
    await writeContract({
      contractAddress: vault,
      callData,
      ucSession: opts?.ucSession ?? loadStoredUcSession(),
    });
    return 'joined';
  } catch {
    /* older vault or already member */
  }

  // 2) Server operator path for pre-joinVault deploys
  try {
    await bootstrapCircleWalletOnVault(account, {
      claimOrganizer: opts?.claimOrganizer === true,
    });
    return 'bootstrapped';
  } catch {
    /* no operator key / not configured — deposit may still auto-join on new vaults */
  }

  return 'skipped';
}

/**
 * Approve USDC then deposit the vault's fixed contribution amount.
 * Auto-ensures vault membership first. Waits for real Arc confirmation —
 * never reports success without on-chain Paid status.
 */
export async function depositToVault(opts?: {
  ucSession?: UcSession | null;
  walletAddress?: string | null;
}): Promise<{
  amount: number;
  txKind: 'circle' | 'injected';
  approveTxHash: string | null;
  depositTxHash: string | null;
  explorerUrl: string | null;
}> {
  const vault = getVaultAddress();
  if (!vault) {
    throw new Error(
      'Vault not configured. Deploy the contract and set VITE_TREASURY_VAULT_ADDRESS.',
    );
  }

  const session = opts?.ucSession ?? loadStoredUcSession();
  const wallet = (opts?.walletAddress || session?.address || null) as Address | null;
  if (!wallet) {
    throw new Error('Connect your wallet first');
  }

  await ensureVaultMembership(wallet, { ucSession: session });

  const amount = (await publicClient.readContract({
    address: vault,
    abi: treasuryVaultAbi,
    functionName: 'contributionAmount',
  })) as bigint;

  if (amount <= 0n) throw new Error('Vault contribution amount is zero');

  // Check USDC balance before attempting (clearer than a silent Circle fail)
  const usdc = (TREASURY_USDC_ADDRESS || ARC_USDC_ERC20_ADDRESS) as Address;
  try {
    const bal = (await publicClient.readContract({
      address: usdc,
      abi: [
        {
          type: 'function',
          name: 'balanceOf',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        },
      ] as const,
      functionName: 'balanceOf',
      args: [wallet],
    })) as bigint;
    if (bal < amount) {
      throw new Error(
        `Not enough USDC in your Circle wallet. Need ${usdcToNumber(amount)}, have ${usdcToNumber(bal)}. Get testnet USDC from the faucet.`,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Not enough')) throw e;
  }

  const approveData = encodeFunctionData({
    abi: erc20ApproveAbi,
    functionName: 'approve',
    args: [vault, amount],
  });

  const depositData = encodeFunctionData({
    abi: treasuryVaultAbi,
    functionName: 'deposit',
  });

  // 1) Approve USDC (PIN #1). Confirm via on-chain allowance — not Circle hash alone.
  const approve = await writeContract({
    contractAddress: usdc,
    callData: approveData,
    refId: `approve-vault-${Date.now()}`,
    ucSession: session,
    waitForTx: true,
  });

  const allowed = await waitForAllowance(usdc, wallet, vault, amount, 90_000);
  if (!allowed) {
    const hint = approve.txHash ? ` ${ARC_EXPLORER_URL}/tx/${approve.txHash}` : '';
    throw new Error(
      `USDC approve did not land on Arc after PIN.${hint} Open Circle activity for failures, wait, and try again.`,
    );
  }

  // 2) Deposit (PIN #2). Confirm via vault Paid status.
  const deposit = await writeContract({
    contractAddress: vault,
    callData: depositData,
    refId: `deposit-vault-${Date.now()}`,
    ucSession: session,
    waitForTx: true,
  });

  const paid = await waitForContributionPaid(vault, wallet, 120_000);
  if (!paid) {
    const hint = deposit.txHash
      ? ` ${ARC_EXPLORER_URL}/tx/${deposit.txHash}`
      : approve.txHash
        ? ` Approve ok: ${ARC_EXPLORER_URL}/tx/${approve.txHash}`
        : '';
    throw new Error(
      `Deposit PIN finished but vault still shows unpaid.${hint} Check Arc explorer / Circle activity and try Deposit again.`,
    );
  }

  const depositTxHash = deposit.txHash;
  return {
    amount: usdcToNumber(amount),
    txKind: session ? 'circle' : 'injected',
    approveTxHash: approve.txHash,
    depositTxHash,
    explorerUrl: depositTxHash
      ? `${ARC_EXPLORER_URL}/tx/${depositTxHash}`
      : `${ARC_EXPLORER_URL}/address/${vault}`,
  };
}

/**
 * Push founder coop rules (amount + frequency) onto the vault.
 * Amount must be ≥ $10. Only the on-chain organizer can call this.
 */
export async function applyCoopRulesToVault(params: {
  amountUsd: number;
  frequency: ContributionFrequency;
  ucSession?: UcSession | null;
}): Promise<void> {
  const vault = getVaultAddress();
  if (!vault) {
    throw new Error(
      'Vault not configured. Deploy the contract and set VITE_TREASURY_VAULT_ADDRESS.',
    );
  }
  if (!Number.isFinite(params.amountUsd) || params.amountUsd < MIN_CONTRIBUTION_USDC) {
    throw new Error(`Contribution must be at least $${MIN_CONTRIBUTION_USDC}.`);
  }

  const raw = usdcToRaw(params.amountUsd);
  const freq = frequencyToOnChain(params.frequency);

  // Prefer full rules call (new vaults); fall back to amount-only for older deploys
  try {
    const callData = encodeFunctionData({
      abi: treasuryVaultAbi,
      functionName: 'setContributionRules',
      args: [raw, freq],
    });
    await writeContract({
      contractAddress: vault,
      callData,
      ucSession: params.ucSession ?? loadStoredUcSession(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/function|selector|execution reverted|not found/i.test(msg)) {
      const callData = encodeFunctionData({
        abi: treasuryVaultAbi,
        functionName: 'setContributionAmount',
        args: [raw],
      });
      await writeContract({
        contractAddress: vault,
        callData,
        ucSession: params.ucSession ?? loadStoredUcSession(),
      });
      return;
    }
    throw err;
  }
}

export async function triggerVaultPayout(opts?: {
  ucSession?: UcSession | null;
}): Promise<void> {
  const vault = getVaultAddress();
  if (!vault) {
    throw new Error(
      'Vault not configured. Deploy the contract and set VITE_TREASURY_VAULT_ADDRESS.',
    );
  }

  const callData = encodeFunctionData({
    abi: treasuryVaultAbi,
    functionName: 'triggerPayout',
  });

  await writeContract({
    contractAddress: vault,
    callData,
    ucSession: opts?.ucSession ?? loadStoredUcSession(),
  });
}

export async function registerMemberOnVault(
  member: Address,
  opts?: { ucSession?: UcSession | null },
): Promise<void> {
  const vault = getVaultAddress();
  if (!vault) {
    throw new Error(
      'Vault not configured. Deploy the contract and set VITE_TREASURY_VAULT_ADDRESS.',
    );
  }

  const callData = encodeFunctionData({
    abi: treasuryVaultAbi,
    functionName: 'registerMember',
    args: [member],
  });

  await writeContract({
    contractAddress: vault,
    callData,
    ucSession: opts?.ucSession ?? loadStoredUcSession(),
  });
}

export type VaultBootstrapResult = {
  vault: string;
  member: string;
  alreadyMember: boolean;
  registered: boolean;
  organizer: string;
  operator: string;
  organizerTransferred: boolean;
  registerTxHash: string | null;
  transferTxHash: string | null;
  message: string;
};

/**
 * Server-side register (and optional organizer transfer) for Circle wallets.
 * Uses VAULT_OPERATOR_PRIVATE_KEY on the API — the deploy EOA — so members can
 * onboard without signing as the deploy key in the browser.
 */
export async function bootstrapCircleWalletOnVault(
  circleWallet: string,
  opts?: { claimOrganizer?: boolean },
): Promise<VaultBootstrapResult> {
  const res = await fetch('/api/onchain/vault/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-wallet-address': circleWallet,
    },
    body: JSON.stringify({
      // Keep deploy/operator key as organizer so Vercel can register every Circle wallet
      claimOrganizer: opts?.claimOrganizer === true,
    }),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) msg = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return (await res.json()) as VaultBootstrapResult;
}

export async function fetchVaultOperatorStatus(): Promise<{
  configured: boolean;
  vault: string | null;
}> {
  try {
    const res = await fetch('/api/onchain/vault/operator-status', {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { configured: false, vault: null };
    return (await res.json()) as { configured: boolean; vault: string | null };
  } catch {
    return { configured: false, vault: null };
  }
}

/** Whether coop founder rules differ from on-chain vault settings. */
export function rulesOutOfSync(
  snap: VaultSnapshot | null,
  coopAmount: number | undefined,
  coopFrequency: ContributionFrequency | string | undefined,
): boolean {
  if (!snap?.configured || coopAmount == null) return false;
  const amountDiff = Math.abs(snap.contributionAmount - coopAmount) > 0.000001;
  const freqDiff =
    snap.contributionFrequency != null &&
    coopFrequency != null &&
    snap.contributionFrequency !== coopFrequency;
  return amountDiff || Boolean(freqDiff);
}

export { ARC_USDC_ERC20_ADDRESS, MIN_CONTRIBUTION_USDC };

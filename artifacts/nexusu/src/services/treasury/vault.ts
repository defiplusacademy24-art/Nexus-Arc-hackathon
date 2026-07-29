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
  http,
  parseUnits,
  type Address,
  type Hex,
} from 'viem';
import { arcTestnet } from 'viem/chains';
import {
  ARC_RPC_URL,
  ARC_USDC_ERC20_ADDRESS,
  ARC_TESTNET_CHAIN_ID,
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
  transport: http(ARC_RPC_URL, {
    retryCount: 2,
    retryDelay: 800,
    timeout: 20_000,
  }),
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
    return 'Arc testnet RPC is busy (rate limited). Wait a few seconds and tap Refresh.';
  }
  if (/NotMember|not a member|Not registered/i.test(msg)) {
    return 'Your wallet is not registered on this vault. The organizer must register you first.';
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

  // One multicall for core state (instead of 8+ parallel eth_calls that hit rate limits)
  const core = await publicClient.multicall({
    allowFailure: true,
    contracts: [
      { address: vault, abi: treasuryVaultAbi, functionName: 'getTreasuryBalance' },
      { address: vault, abi: treasuryVaultAbi, functionName: 'contributionAmount' },
      { address: vault, abi: treasuryVaultAbi, functionName: 'currentCycle' },
      { address: vault, abi: treasuryVaultAbi, functionName: 'getCurrentPayoutRecipient' },
      { address: vault, abi: treasuryVaultAbi, functionName: 'getNextPayoutRecipient' },
      { address: vault, abi: treasuryVaultAbi, functionName: 'canTriggerPayout' },
      { address: vault, abi: treasuryVaultAbi, functionName: 'getTreasuryAllocationBreakdown' },
      { address: vault, abi: treasuryVaultAbi, functionName: 'organizer' },
      { address: vault, abi: treasuryVaultAbi, functionName: 'contributionFrequency' },
      { address: vault, abi: treasuryVaultAbi, functionName: 'contributionPeriodSeconds' },
    ],
  });

  const balRaw = resultValue<bigint>(core[0]);
  const contribRaw = resultValue<bigint>(core[1]);
  const cycle = resultValue<number | bigint>(core[2]);
  const currentPair = resultValue<readonly [Address, number]>(core[3]);
  const nextPair = resultValue<readonly [Address, number]>(core[4]);
  const canPay = resultValue<readonly [boolean, number, number]>(core[5]);
  const breakdownRaw = resultValue<{
    totalBalance: bigint;
    rotationFund: bigint;
    loanPool: bigint;
    emergencyReserve: bigint;
    savingsInvestment: bigint;
  }>(core[6]);
  const organizerRaw = resultValue<Address>(core[7]);
  const freqRaw = resultValue<number | bigint>(core[8]);
  const periodRaw = resultValue<bigint | number>(core[9]);

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
            functionName: 'getMemberRotationPosition',
            args: [account],
          },
          {
            address: vault,
            abi: treasuryVaultAbi,
            functionName: 'nextContributionAt',
            args: [account],
          },
          {
            address: vault,
            abi: treasuryVaultAbi,
            functionName: 'canDeposit',
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
        const pos = resultValue<number | bigint>(memberCore[2]);
        if (pos != null) joinPosition = Number(pos);
        const nextAt = resultValue<number | bigint>(memberCore[3]);
        nextContributionAt = nextAt != null && Number(nextAt) > 0 ? Number(nextAt) : null;
        const can = resultValue<readonly [boolean, string]>(memberCore[4]);
        if (can) {
          canDepositNow = Boolean(can[0]);
          canDepositReason = can[1] || null;
        }
      }
    } catch {
      /* member views optional when RPC is throttled */
    }
  }

  const [ready, required, paid] = canPay ?? [false, 0, 0];
  const [curRecipient, curPos] = currentPair ?? (['0x0000000000000000000000000000000000000000', 0] as const);
  const [nxtRecipient, nxtPos] = nextPair ?? (['0x0000000000000000000000000000000000000000', 0] as const);
  const bd = breakdownRaw;

  return {
    configured: true,
    vaultAddress: vault,
    totalBalance: balRaw != null ? usdcToNumber(balRaw) : 0,
    contributionAmount: contribRaw != null ? usdcToNumber(contribRaw) : 0,
    contributionAmountRaw: contribRaw ?? 0n,
    contributionFrequency,
    currentCycle: cycle != null ? Number(cycle) : 0,
    currentRecipient: curRecipient,
    currentPosition: Number(curPos),
    nextRecipient:
      nxtRecipient && nxtRecipient !== '0x0000000000000000000000000000000000000000'
        ? nxtRecipient
        : null,
    nextPosition: Number(nxtPos),
    isMember,
    isOrganizer,
    organizer,
    contributionStatus,
    canPayout: Boolean(ready),
    paidCount: Number(paid),
    requiredCount: Number(required),
    breakdown: bd
      ? {
          totalBalance: usdcToNumber(bd.totalBalance),
          rotationFund: usdcToNumber(bd.rotationFund),
          loanPool: usdcToNumber(bd.loanPool),
          emergencyReserve: usdcToNumber(bd.emergencyReserve),
          savingsInvestment: usdcToNumber(bd.savingsInvestment),
        }
      : null,
    joinPosition,
    nextContributionAt,
    canDepositNow,
    canDepositReason,
    periodSeconds,
  };
}

async function writeContract(params: {
  contractAddress: Address;
  callData: Hex;
  ucSession?: UcSession | null;
}): Promise<void> {
  const session = params.ucSession ?? loadStoredUcSession();
  if (session) {
    await ucWrite(session, {
      contractAddress: params.contractAddress,
      callData: params.callData,
    });
    return;
  }

  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error(
      'No signing wallet available. Sign in with Circle email or connect an injected wallet on Arc Testnet.',
    );
  }

  await ensureArcTestnet(provider);
  const accounts = (await provider.request({
    method: 'eth_requestAccounts',
  })) as string[];
  const from = accounts[0];
  if (!from) throw new Error('No account selected in the wallet');

  await provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from,
        to: params.contractAddress,
        data: params.callData,
        chainId: `0x${ARC_TESTNET_CHAIN_ID.toString(16)}`,
      },
    ],
  });
}

/**
 * Approve USDC then deposit the vault's fixed contribution amount.
 */
export async function depositToVault(opts?: {
  ucSession?: UcSession | null;
}): Promise<{ amount: number; txKind: 'circle' | 'injected' }> {
  const vault = getVaultAddress();
  if (!vault) {
    throw new Error(
      'Vault not configured. Deploy the contract and set VITE_TREASURY_VAULT_ADDRESS.',
    );
  }

  const amount = (await publicClient.readContract({
    address: vault,
    abi: treasuryVaultAbi,
    functionName: 'contributionAmount',
  })) as bigint;

  if (amount <= 0n) throw new Error('Vault contribution amount is zero');

  const approveData = encodeFunctionData({
    abi: erc20ApproveAbi,
    functionName: 'approve',
    args: [vault, amount],
  });

  const depositData = encodeFunctionData({
    abi: treasuryVaultAbi,
    functionName: 'deposit',
  });

  const session = opts?.ucSession ?? loadStoredUcSession();
  const usdc = (TREASURY_USDC_ADDRESS || ARC_USDC_ERC20_ADDRESS) as Address;

  await writeContract({
    contractAddress: usdc,
    callData: approveData,
    ucSession: session,
  });

  await writeContract({
    contractAddress: vault,
    callData: depositData,
    ucSession: session,
  });

  return {
    amount: usdcToNumber(amount),
    txKind: session ? 'circle' : 'injected',
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
      claimOrganizer: opts?.claimOrganizer !== false,
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

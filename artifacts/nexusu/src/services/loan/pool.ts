/**
 * On-chain CooperativeLoanPool client (Arc Testnet).
 *
 * Reads: public RPC via viem.
 * Writes: Circle email wallets (ucWrite) or injected EOA.
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
  ARC_USDC_ERC20_ADDRESS,
  ARC_TESTNET_CHAIN_ID,
  createArcTransport,
} from '@/config/arc';
import {
  LOAN_POOL_ADDRESS,
  LOAN_POOL_USDC_ADDRESS,
  loanPoolAbi,
  erc20ApproveAbi,
} from '@/config/loan-pool';
import {
  loadStoredUcSession,
  ucWrite,
  type UcSession,
} from '@/services/circle/userWallet';
import { ensureArcTestnet, getInjectedProvider } from '@/services/wallet/arc-network';
import type { Loan, LoanPurposeCategory, LoanStatus, RiskLevelLabel } from '@/types';

export type OnChainLoanStatus = 0 | 1 | 2 | 3 | 4; // Pending Active Completed Rejected Defaulted

export type PoolSnapshot = {
  configured: boolean;
  poolAddress: Address | null;
  usdcBalance: number;
  liquidity: number;
  outstandingPrincipal: number;
  interestAccrued: number;
  loanCount: number;
  maxLoanBps: number;
  organizer: Address | null;
  lendingAgent: Address | null;
  membershipVault: Address | null;
  isOrganizer: boolean;
  isApprover: boolean;
  isEligibleBorrower: boolean;
  canApply: boolean;
  canApplyReason: string | null;
  openLoanId: number | null;
};

export type OnChainLoanRaw = {
  loanId: number;
  borrower: Address;
  principal: bigint;
  interestBps: number;
  totalInterest: bigint;
  totalDue: bigint;
  amountPaid: bigint;
  interestPaid: bigint;
  termMonths: number;
  requestedAt: number;
  disbursedAt: number;
  dueDate: number;
  status: OnChainLoanStatus;
  purpose: string;
};

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: createArcTransport(),
});

function usdcToNumber(raw: bigint): number {
  return Number(formatUnits(raw, 6));
}

export function usdcToRaw(amount: number): bigint {
  // Avoid float dust: keep 6 decimal places as string
  const fixed = Number.isFinite(amount) ? amount.toFixed(6) : '0';
  return parseUnits(fixed, 6);
}

export function isLoanPoolConfigured(): boolean {
  return Boolean(LOAN_POOL_ADDRESS && /^0x[a-fA-F0-9]{40}$/.test(LOAN_POOL_ADDRESS));
}

export function getLoanPoolAddress(): Address | null {
  if (!isLoanPoolConfigured()) return null;
  return LOAN_POOL_ADDRESS as Address;
}

export function onChainLoanIdFromAppId(appId: string): number | null {
  const m = /^onchain-(\d+)$/i.exec(appId);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function appLoanId(onChainId: number): string {
  return `onchain-${onChainId}`;
}

const STATUS_TO_UI: LoanStatus[] = [
  'pending',
  'active',
  'completed',
  'rejected',
  'defaulted',
];

export function friendlyLoanError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  if (/not_eligible_borrower/i.test(msg)) {
    return 'You are not an eligible borrower yet. Join the Treasury Vault as a member, or ask the organizer to register your wallet on the Loan Pool.';
  }
  if (/has_open_loan|open loan/i.test(msg)) {
    return 'You already have an open loan (pending or active). Finish or repay it before applying again.';
  }
  if (/InsufficientLiquidity|not enough USDC liquidity/i.test(msg)) {
    return 'Loan Pool has insufficient USDC. Fund the pool with fundPool, then approve the loan.';
  }
  if (/ExceedsMaxLoan|max loan share/i.test(msg)) {
    return 'Amount exceeds the max share of pool liquidity allowed for a single loan (default 25%). Fund more or request less.';
  }
  if (/request limit reached|rate limit|429|too many requests/i.test(msg)) {
    return 'Arc testnet RPC is busy (rate limited). Wait a few seconds and try again.';
  }
  if (/NotEligibleBorrower|not_eligible_borrower|not_eligible/i.test(msg)) {
    return 'You are not an eligible borrower. The organizer must register you (or register you on the treasury vault if membership is linked).';
  }
  if (/HasOpenLoan|has_open_loan/i.test(msg)) {
    return 'You already have an open loan (pending, active, or defaulted). Finish or wait for a decision first.';
  }
  if (/InsufficientLiquidity/i.test(msg)) {
    return 'Loan pool does not have enough USDC liquidity. The organizer must fund the pool.';
  }
  if (/ExceedsMaxLoan/i.test(msg)) {
    return 'Amount exceeds the max loan share of available liquidity (default 25%).';
  }
  if (/NotApprover|not approver/i.test(msg)) {
    return 'Only the organizer or designated lending agent can approve or reject loans.';
  }
  if (/NotOrganizer/i.test(msg)) {
    return 'Only the pool organizer can perform this action.';
  }
  if (/BadStatus/i.test(msg)) {
    return 'Loan is not in the right status for this action.';
  }
  if (/InvalidTerm/i.test(msg)) {
    return 'Term must be 1–6 months.';
  }
  if (/InvalidAmount/i.test(msg)) {
    return 'Invalid amount.';
  }
  if (/user rejected|denied|rejected the request/i.test(msg)) {
    return 'Transaction was cancelled in the wallet.';
  }
  if (/Failed to fetch|network|timeout|ECONNREFUSED/i.test(msg)) {
    return 'Network error talking to Arc. Check your connection and try again.';
  }
  if (msg.length > 220) return `${msg.slice(0, 200)}…`;
  return msg;
}

function emptySnapshot(): PoolSnapshot {
  return {
    configured: false,
    poolAddress: null,
    usdcBalance: 0,
    liquidity: 0,
    outstandingPrincipal: 0,
    interestAccrued: 0,
    loanCount: 0,
    maxLoanBps: 2500,
    organizer: null,
    lendingAgent: null,
    membershipVault: null,
    isOrganizer: false,
    isApprover: false,
    isEligibleBorrower: false,
    canApply: false,
    canApplyReason: null,
    openLoanId: null,
  };
}

function resultValue<T>(r: { status: 'success' | 'failure'; result?: unknown }): T | null {
  if (r.status !== 'success') return null;
  return r.result as T;
}

export async function fetchPoolSnapshot(wallet?: string | null): Promise<PoolSnapshot> {
  const pool = getLoanPoolAddress();
  if (!pool) return emptySnapshot();

  const account = wallet && /^0x[a-fA-F0-9]{40}$/i.test(wallet) ? (wallet as Address) : null;

  const core = await publicClient.multicall({
    allowFailure: true,
    contracts: [
      { address: pool, abi: loanPoolAbi, functionName: 'getPoolStats' },
      { address: pool, abi: loanPoolAbi, functionName: 'organizer' },
      { address: pool, abi: loanPoolAbi, functionName: 'lendingAgent' },
      { address: pool, abi: loanPoolAbi, functionName: 'membershipVault' },
      { address: pool, abi: loanPoolAbi, functionName: 'maxLoanBps' },
    ],
  });

  const stats = resultValue<readonly [bigint, bigint, bigint, bigint, bigint]>(core[0]);
  if (!stats) {
    throw new Error('request limit reached');
  }

  const organizer = resultValue<Address>(core[1]);
  const agent = resultValue<Address>(core[2]);
  const membershipVault = resultValue<Address>(core[3]);
  const maxBps = resultValue<number>(core[4]);

  let isEligibleBorrower = false;
  let canApply = false;
  let canApplyReason: string | null = null;
  let openLoanId: number | null = null;

  const isOrganizer = Boolean(
    account && organizer && account.toLowerCase() === organizer.toLowerCase(),
  );
  const isApprover = Boolean(
    isOrganizer ||
      (account && agent && agent !== '0x0000000000000000000000000000000000000000' &&
        account.toLowerCase() === agent.toLowerCase()),
  );

  if (account) {
    try {
      const memberCore = await publicClient.multicall({
        allowFailure: true,
        contracts: [
          {
            address: pool,
            abi: loanPoolAbi,
            functionName: 'isEligibleBorrower',
            args: [account],
          },
          {
            address: pool,
            abi: loanPoolAbi,
            functionName: 'canApply',
            args: [account],
          },
          {
            address: pool,
            abi: loanPoolAbi,
            functionName: 'openLoanId',
            args: [account],
          },
        ],
      });
      isEligibleBorrower = Boolean(resultValue<boolean>(memberCore[0]));
      const can = resultValue<readonly [boolean, string]>(memberCore[1]);
      if (can) {
        canApply = Boolean(can[0]);
        canApplyReason = can[1] || null;
      }
      const open = resultValue<bigint | number>(memberCore[2]);
      openLoanId = open != null && Number(open) > 0 ? Number(open) : null;
    } catch {
      /* optional when RPC throttled */
    }
  }

  return {
    configured: true,
    poolAddress: pool,
    usdcBalance: usdcToNumber(stats[0]),
    liquidity: usdcToNumber(stats[1]),
    outstandingPrincipal: usdcToNumber(stats[2]),
    interestAccrued: usdcToNumber(stats[3]),
    loanCount: Number(stats[4]),
    maxLoanBps: maxBps != null ? Number(maxBps) : 2500,
    organizer: organizer ?? null,
    lendingAgent:
      agent && agent !== '0x0000000000000000000000000000000000000000' ? agent : null,
    membershipVault:
      membershipVault && membershipVault !== '0x0000000000000000000000000000000000000000'
        ? membershipVault
        : null,
    isOrganizer,
    isApprover,
    isEligibleBorrower,
    canApply,
    canApplyReason,
    openLoanId,
  };
}

function mapRawLoan(raw: OnChainLoanRaw, displayName?: string): Loan {
  const principal = usdcToNumber(raw.principal);
  const totalInterest = usdcToNumber(raw.totalInterest);
  const totalDue = usdcToNumber(raw.totalDue);
  const paid = usdcToNumber(raw.amountPaid);
  const interestPaid = usdcToNumber(raw.interestPaid);
  const rate = raw.interestBps / 10_000;
  const months = raw.termMonths;
  const monthlyPayment =
    months > 0 ? Math.round((totalDue / months) * 100) / 100 : totalDue;
  const status = STATUS_TO_UI[raw.status] ?? 'pending';
  const short = raw.borrower.slice(2, 4).toUpperCase();
  const name =
    displayName ||
    `${raw.borrower.slice(0, 6)}…${raw.borrower.slice(-4)}`;

  const purpose = (raw.purpose || 'Other') as LoanPurposeCategory;
  const riskLevel: RiskLevelLabel = 'Medium';

  return {
    id: appLoanId(raw.loanId),
    borrowerId: raw.borrower.toLowerCase(),
    borrowerName: name,
    borrowerAvatar: '',
    borrowerInitials: short,
    borrowerWallet: raw.borrower,
    requestedAmount: principal,
    approvedAmount:
      status === 'active' || status === 'completed' || status === 'defaulted'
        ? principal
        : status === 'pending'
          ? principal
          : undefined,
    purpose,
    purposeCategory: PURPOSES.includes(purpose as LoanPurposeCategory)
      ? (purpose as LoanPurposeCategory)
      : 'Other',
    reason: raw.purpose,
    riskScore: 40,
    riskLevel,
    repaymentMonths: months,
    monthlyPayment,
    interestRate: rate,
    totalInterest,
    totalRepayment: totalDue,
    status: status === 'active' ? 'active' : status,
    aiRecommendation: 'On-chain loan pool',
    repaymentForecast: 80,
    requestedAt: raw.requestedAt
      ? new Date(raw.requestedAt * 1000).toISOString()
      : new Date().toISOString(),
    disbursedAt: raw.disbursedAt
      ? new Date(raw.disbursedAt * 1000).toISOString()
      : undefined,
    dueDate: raw.dueDate ? new Date(raw.dueDate * 1000).toISOString() : undefined,
    approvedByAi: false,
    disbursementReady: status === 'active',
    paidAmount: paid,
    interestPaid,
    repaymentHistory: [],
    cashDisbursedFromTreasury: status === 'active' || status === 'completed' || status === 'defaulted',
    cashReturnedToTreasury: Math.max(0, paid - interestPaid),
  };
}

const PURPOSES: LoanPurposeCategory[] = [
  'Business',
  'Education',
  'Emergency',
  'Medical',
  'Agriculture',
  'Personal',
  'Other',
];

async function readLoan(pool: Address, loanId: number): Promise<OnChainLoanRaw | null> {
  try {
    const r = (await publicClient.readContract({
      address: pool,
      abi: loanPoolAbi,
      functionName: 'getLoan',
      args: [BigInt(loanId)],
    })) as {
      borrower: Address;
      principal: bigint;
      interestBps: number;
      totalInterest: bigint;
      totalDue: bigint;
      amountPaid: bigint;
      interestPaid: bigint;
      termMonths: number;
      requestedAt: bigint | number;
      disbursedAt: bigint | number;
      dueDate: bigint | number;
      status: number;
      purpose: string;
    };

    return {
      loanId,
      borrower: r.borrower,
      principal: r.principal,
      interestBps: Number(r.interestBps),
      totalInterest: r.totalInterest,
      totalDue: r.totalDue,
      amountPaid: r.amountPaid,
      interestPaid: r.interestPaid,
      termMonths: Number(r.termMonths),
      requestedAt: Number(r.requestedAt),
      disbursedAt: Number(r.disbursedAt),
      dueDate: Number(r.dueDate),
      status: Number(r.status) as OnChainLoanStatus,
      purpose: r.purpose,
    };
  } catch {
    return null;
  }
}

/**
 * Load all on-chain loans (newest first). Caps RPC load at last 50 ids.
 */
export async function fetchOnChainLoans(opts?: {
  nameByWallet?: Record<string, string>;
}): Promise<Loan[]> {
  const pool = getLoanPoolAddress();
  if (!pool) return [];

  const nextId = (await publicClient.readContract({
    address: pool,
    abi: loanPoolAbi,
    functionName: 'nextLoanId',
  })) as bigint;

  const count = Number(nextId) - 1;
  if (count <= 0) return [];

  const start = Math.max(1, count - 49);
  const ids: number[] = [];
  for (let i = count; i >= start; i--) ids.push(i);

  const contracts = ids.map((id) => ({
    address: pool,
    abi: loanPoolAbi,
    functionName: 'getLoan' as const,
    args: [BigInt(id)] as const,
  }));

  const results = await publicClient.multicall({
    allowFailure: true,
    contracts,
  });

  const loans: Loan[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status !== 'success' || !r.result) continue;
    const row = r.result as {
      borrower: Address;
      principal: bigint;
      interestBps: number;
      totalInterest: bigint;
      totalDue: bigint;
      amountPaid: bigint;
      interestPaid: bigint;
      termMonths: number;
      requestedAt: bigint | number;
      disbursedAt: bigint | number;
      dueDate: bigint | number;
      status: number;
      purpose: string;
    };
    const raw: OnChainLoanRaw = {
      loanId: ids[i],
      borrower: row.borrower,
      principal: row.principal,
      interestBps: Number(row.interestBps),
      totalInterest: row.totalInterest,
      totalDue: row.totalDue,
      amountPaid: row.amountPaid,
      interestPaid: row.interestPaid,
      termMonths: Number(row.termMonths),
      requestedAt: Number(row.requestedAt),
      disbursedAt: Number(row.disbursedAt),
      dueDate: Number(row.dueDate),
      status: Number(row.status) as OnChainLoanStatus,
      purpose: row.purpose,
    };
    const name = opts?.nameByWallet?.[raw.borrower.toLowerCase()];
    loans.push(mapRawLoan(raw, name));
  }
  return loans;
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

export async function applyForLoanOnChain(params: {
  principalUsd: number;
  termMonths: number;
  purpose: string;
  ucSession?: UcSession | null;
}): Promise<void> {
  const pool = getLoanPoolAddress();
  if (!pool) throw new Error('Loan pool not configured. Set VITE_LOAN_POOL_ADDRESS.');
  if (!Number.isFinite(params.principalUsd) || params.principalUsd <= 0) {
    throw new Error('Enter a valid loan amount.');
  }
  if (params.termMonths < 1 || params.termMonths > 6) {
    throw new Error('Term must be 1–6 months.');
  }

  const raw = usdcToRaw(params.principalUsd);
  const callData = encodeFunctionData({
    abi: loanPoolAbi,
    functionName: 'applyForLoan',
    args: [raw, params.termMonths, params.purpose || 'Other'],
  });

  await writeContract({
    contractAddress: pool,
    callData,
    ucSession: params.ucSession ?? loadStoredUcSession(),
  });
}

export async function approveLoanOnChain(
  loanId: number,
  opts?: { ucSession?: UcSession | null },
): Promise<void> {
  const pool = getLoanPoolAddress();
  if (!pool) throw new Error('Loan pool not configured. Set VITE_LOAN_POOL_ADDRESS.');

  const callData = encodeFunctionData({
    abi: loanPoolAbi,
    functionName: 'approveLoan',
    args: [BigInt(loanId)],
  });

  await writeContract({
    contractAddress: pool,
    callData,
    ucSession: opts?.ucSession ?? loadStoredUcSession(),
  });
}

export async function rejectLoanOnChain(
  loanId: number,
  opts?: { ucSession?: UcSession | null },
): Promise<void> {
  const pool = getLoanPoolAddress();
  if (!pool) throw new Error('Loan pool not configured. Set VITE_LOAN_POOL_ADDRESS.');

  const callData = encodeFunctionData({
    abi: loanPoolAbi,
    functionName: 'rejectLoan',
    args: [BigInt(loanId)],
  });

  await writeContract({
    contractAddress: pool,
    callData,
    ucSession: opts?.ucSession ?? loadStoredUcSession(),
  });
}

/**
 * Approve USDC then repay. Caps amount to remaining due when known.
 */
export async function repayLoanOnChain(params: {
  loanId: number;
  amountUsd: number;
  ucSession?: UcSession | null;
}): Promise<{ amount: number }> {
  const pool = getLoanPoolAddress();
  if (!pool) throw new Error('Loan pool not configured. Set VITE_LOAN_POOL_ADDRESS.');
  if (!Number.isFinite(params.amountUsd) || params.amountUsd <= 0) {
    throw new Error('Enter a valid repayment amount.');
  }

  let payRaw = usdcToRaw(params.amountUsd);
  try {
    const remaining = (await publicClient.readContract({
      address: pool,
      abi: loanPoolAbi,
      functionName: 'remainingBalance',
      args: [BigInt(params.loanId)],
    })) as bigint;
    if (remaining > 0n && payRaw > remaining) payRaw = remaining;
  } catch {
    /* use requested amount */
  }

  const usdc = (LOAN_POOL_USDC_ADDRESS || ARC_USDC_ERC20_ADDRESS) as Address;
  const session = params.ucSession ?? loadStoredUcSession();

  const approveData = encodeFunctionData({
    abi: erc20ApproveAbi,
    functionName: 'approve',
    args: [pool, payRaw],
  });
  await writeContract({ contractAddress: usdc, callData: approveData, ucSession: session });

  const repayData = encodeFunctionData({
    abi: loanPoolAbi,
    functionName: 'repay',
    args: [BigInt(params.loanId), payRaw],
  });
  await writeContract({ contractAddress: pool, callData: repayData, ucSession: session });

  return { amount: usdcToNumber(payRaw) };
}

export async function fundPoolOnChain(params: {
  amountUsd: number;
  ucSession?: UcSession | null;
}): Promise<void> {
  const pool = getLoanPoolAddress();
  if (!pool) throw new Error('Loan pool not configured. Set VITE_LOAN_POOL_ADDRESS.');
  if (!Number.isFinite(params.amountUsd) || params.amountUsd <= 0) {
    throw new Error('Enter a valid fund amount.');
  }

  const raw = usdcToRaw(params.amountUsd);
  const usdc = (LOAN_POOL_USDC_ADDRESS || ARC_USDC_ERC20_ADDRESS) as Address;
  const session = params.ucSession ?? loadStoredUcSession();

  const approveData = encodeFunctionData({
    abi: erc20ApproveAbi,
    functionName: 'approve',
    args: [pool, raw],
  });
  await writeContract({ contractAddress: usdc, callData: approveData, ucSession: session });

  const fundData = encodeFunctionData({
    abi: loanPoolAbi,
    functionName: 'fundPool',
    args: [raw],
  });
  await writeContract({ contractAddress: pool, callData: fundData, ucSession: session });
}

export async function registerBorrowerOnChain(
  borrower: Address,
  opts?: { ucSession?: UcSession | null },
): Promise<void> {
  const pool = getLoanPoolAddress();
  if (!pool) throw new Error('Loan pool not configured. Set VITE_LOAN_POOL_ADDRESS.');

  const callData = encodeFunctionData({
    abi: loanPoolAbi,
    functionName: 'registerBorrower',
    args: [borrower],
  });

  await writeContract({
    contractAddress: pool,
    callData,
    ucSession: opts?.ucSession ?? loadStoredUcSession(),
  });
}

export async function quoteLoanOnChain(
  principalUsd: number,
  termMonths: number,
): Promise<{
  interestBps: number;
  totalInterest: number;
  totalDue: number;
  monthlyPayment: number;
} | null> {
  const pool = getLoanPoolAddress();
  if (!pool || !Number.isFinite(principalUsd) || principalUsd <= 0) return null;
  if (termMonths < 1 || termMonths > 6) return null;

  try {
    const r = (await publicClient.readContract({
      address: pool,
      abi: loanPoolAbi,
      functionName: 'quoteLoan',
      args: [usdcToRaw(principalUsd), termMonths],
    })) as readonly [number, bigint, bigint, bigint];
    return {
      interestBps: Number(r[0]),
      totalInterest: usdcToNumber(r[1]),
      totalDue: usdcToNumber(r[2]),
      monthlyPayment: usdcToNumber(r[3]),
    };
  } catch {
    return null;
  }
}

export { readLoan, LOAN_POOL_ADDRESS };

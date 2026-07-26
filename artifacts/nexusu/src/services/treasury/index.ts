/**
 * Treasury service — real cooperative balances + transaction-derived series.
 * On-chain vault: see `./vault` (CooperativeTreasuryVault on Arc).
 */

import type { TreasurySnapshot, CashFlowPoint } from '@/types';

export type TreasuryTxn = {
  type: string;
  amount: number;
  createdAt: string;
};

/**
 * Default off-chain treasury allocation (matches product policy):
 * 60% Rotation Fund · 30% Loan Pool · 5% Emergency Reserve · 5% Savings / Investments
 */
export const TREASURY_ALLOCATION = {
  rotation: 0.6,
  loanPool: 0.3,
  emergency: 0.05,
  savings: 0.05,
} as const;

/** Empty snapshot — use buildSnapshotFromBalance / real API instead. */
export const TREASURY_SNAPSHOT: TreasurySnapshot = {
  availableBalance: 0,
  rotationFund: 0,
  reservedFunds: 0,
  loanPool: 0,
  emergencyReserve: 0,
  savingsInvestment: 0,
  pendingContributions: 0,
  monthlyInflow: 0,
  monthlyOutflow: 0,
  netFlow: 0,
};

/** Empty — charts must be built from real transactions. */
export const CASH_FLOW_HISTORY: CashFlowPoint[] = [];
export const CONTRIBUTION_TREND: Array<{ label: string; value: number }> = [];

export function buildSnapshotFromBalance(
  totalBalance: number,
  monthlyInflow = 0,
  monthlyOutflow = 0,
): TreasurySnapshot {
  const cash = Math.max(0, totalBalance);
  const rotationFund = Math.round(cash * TREASURY_ALLOCATION.rotation * 100) / 100;
  const loanPool = Math.round(cash * TREASURY_ALLOCATION.loanPool * 100) / 100;
  const emergencyReserve = Math.round(cash * TREASURY_ALLOCATION.emergency * 100) / 100;
  // Remainder absorbs rounding so buckets sum to cash
  const savingsInvestment =
    Math.round((cash - rotationFund - loanPool - emergencyReserve) * 100) / 100;
  const reserved = Math.round((emergencyReserve + savingsInvestment) * 100) / 100;
  return {
    availableBalance: rotationFund,
    rotationFund,
    reservedFunds: reserved,
    loanPool,
    emergencyReserve,
    savingsInvestment,
    pendingContributions: 0,
    monthlyInflow,
    monthlyOutflow,
    netFlow: monthlyInflow - monthlyOutflow,
  };
}

export function buildCashFlowFromTransactions(
  txns: TreasuryTxn[],
  currentBalance: number,
): CashFlowPoint[] {
  if (!txns.length) {
    if (currentBalance <= 0) return [];
    const month = new Date().toLocaleDateString('en-US', { month: 'short' });
    return [{ month, inflow: 0, outflow: 0, balance: currentBalance }];
  }

  type Bucket = { label: string; inflow: number; outflow: number };
  const byMonth = new Map<string, Bucket>();

  for (const t of txns) {
    const d = new Date(t.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short' });
    const entry = byMonth.get(key) ?? { label, inflow: 0, outflow: 0 };
    if (t.type === 'withdrawal') entry.outflow += t.amount;
    else entry.inflow += t.amount;
    byMonth.set(key, entry);
  }

  const sorted = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  let running = currentBalance;
  const points: CashFlowPoint[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const [, v] = sorted[i];
    points.unshift({
      month: v.label,
      inflow: Math.round(v.inflow * 100) / 100,
      outflow: Math.round(v.outflow * 100) / 100,
      balance: Math.round(running * 100) / 100,
    });
    running = running - v.inflow + v.outflow;
  }
  return points;
}

export function buildContributionTrend(
  txns: TreasuryTxn[],
): Array<{ label: string; value: number }> {
  return buildCashFlowFromTransactions(txns, 0).map((p) => ({
    label: p.month,
    value: p.inflow,
  }));
}

export function sumMonthlyFlows(txns: TreasuryTxn[]): {
  monthlyInflow: number;
  monthlyOutflow: number;
} {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  let monthlyInflow = 0;
  let monthlyOutflow = 0;
  for (const t of txns) {
    if (new Date(t.createdAt).getTime() < monthStart) continue;
    if (t.type === 'withdrawal') monthlyOutflow += t.amount;
    else monthlyInflow += t.amount;
  }
  return { monthlyInflow, monthlyOutflow };
}

export async function getSnapshot(): Promise<TreasurySnapshot> {
  return { ...TREASURY_SNAPSHOT };
}

export async function getCashFlow(): Promise<CashFlowPoint[]> {
  return [];
}

export async function recordContribution(_memberId: string, _amount: number): Promise<void> {
  // Future: Arc treasury / contribution contract
}

export async function disburseLoan(_loanId: string, _amount: number): Promise<void> {
  // Future: on-chain loan disbursement
}

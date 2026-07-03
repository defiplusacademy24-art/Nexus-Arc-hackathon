/**
 * Treasury service — abstraction for all treasury operations.
 * Designed to connect to Unicity on-chain treasury management in the future.
 */

import type { TreasurySnapshot, CashFlowPoint } from '@/types';

// ── Snapshot ───────────────────────────────────────────────────────────────────

export const TREASURY_SNAPSHOT: TreasurySnapshot = {
  availableBalance: 28_500,
  reservedFunds: 4_780,
  loanPool: 12_000,
  emergencyReserve: 4_780,
  pendingContributions: 1_750,
  monthlyInflow: 8_750,
  monthlyOutflow: 2_550,
  netFlow: 6_200,
};

// ── Cash flow history (12 months) ─────────────────────────────────────────────

export const CASH_FLOW_HISTORY: CashFlowPoint[] = [
  { month: 'Aug', inflow: 5_200, outflow: 1_800, balance: 22_400 },
  { month: 'Sep', inflow: 5_800, outflow: 2_100, balance: 26_100 },
  { month: 'Oct', inflow: 6_200, outflow: 1_950, balance: 30_350 },
  { month: 'Nov', inflow: 6_800, outflow: 2_800, balance: 34_350 },
  { month: 'Dec', inflow: 7_200, outflow: 3_200, balance: 38_350 },
  { month: 'Jan', inflow: 7_500, outflow: 2_200, balance: 43_650 },
  { month: 'Feb', inflow: 7_800, outflow: 2_400, balance: 49_050 },
  { month: 'Mar', inflow: 8_000, outflow: 2_300, balance: 54_750 },
  { month: 'Apr', inflow: 8_200, outflow: 2_450, balance: 60_500 },
  { month: 'May', inflow: 8_500, outflow: 2_500, balance: 66_500 },
  { month: 'Jun', inflow: 8_750, outflow: 2_550, balance: 72_700 },
  { month: 'Jul', inflow: 9_100, outflow: 2_600, balance: 79_200 },
];

// ── Contribution trend ─────────────────────────────────────────────────────────

export const CONTRIBUTION_TREND = CASH_FLOW_HISTORY.map((p) => ({
  label: p.month,
  value: p.inflow,
}));

// ── Service stubs ──────────────────────────────────────────────────────────────

export async function getSnapshot(): Promise<TreasurySnapshot> {
  return TREASURY_SNAPSHOT;
}

export async function getCashFlow(): Promise<CashFlowPoint[]> {
  return CASH_FLOW_HISTORY;
}

export async function recordContribution(_memberId: string, _amount: number): Promise<void> {
  // Future: write to Unicity on-chain ledger
}

export async function disburseLoan(_loanId: string, _amount: number): Promise<void> {
  // Future: trigger Unicity asset transfer
}

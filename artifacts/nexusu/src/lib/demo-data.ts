/**
 * Empty placeholders only — no fictional cooperatives, members, or metrics.
 * Dashboard pages load real cooperative / treasury / on-chain data, or show zero.
 */

import type {
  Loan, Proposal, SavingsPool, AIMessage, ChartPoint,
} from '@/types';

/** @deprecated Use empty arrays; kept so accidental imports never reintroduce mock rows. */
export const DEMO_LOANS: Loan[] = [];
export const DEMO_PROPOSALS: Proposal[] = [];
export const DEMO_SAVINGS_POOLS: SavingsPool[] = [];
export const INITIAL_AI_MESSAGES: AIMessage[] = [];
export const MEMBER_GROWTH_DATA: ChartPoint[] = [];
export const REPAYMENT_RATE_DATA: ChartPoint[] = [];
export const RISK_DISTRIBUTION: Array<{ name: string; value: number; color: string }> = [];

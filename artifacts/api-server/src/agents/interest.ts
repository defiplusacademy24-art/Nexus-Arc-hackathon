/**
 * Cooperative loan interest schedule (matches CooperativeLoanPool on-chain table).
 *
 * | Term (months) | Interest |
 * |---------------|----------|
 * | 1             | 5%       |
 * | 2             | 6%       |
 * | 3             | 7%       |
 * | 4             | 8%       |
 * | 5             | 9%       |
 * | 6             | 10%      |
 */

import type { LoanInterestQuote } from './types';

/** termMonths → interest basis points for the full term. */
export const INTEREST_BPS_BY_TERM: Readonly<Record<number, number>> = {
  1: 500,
  2: 600,
  3: 700,
  4: 800,
  5: 900,
  6: 1000,
};

export function interestBpsForTerm(termMonths: number): number {
  const bps = INTEREST_BPS_BY_TERM[termMonths];
  if (bps == null) {
    throw new Error(`Invalid termMonths ${termMonths}; expected 1–6`);
  }
  return bps;
}

export function interestPercentForTerm(termMonths: number): number {
  return interestBpsForTerm(termMonths) / 100;
}

/**
 * Quote a loan. Amounts are in the same unit as principal (e.g. USDC human units
 * or base units — caller must be consistent). Simple interest for the full term.
 */
export function quoteLoanInterest(
  principal: number,
  termMonths: number,
  amountPaid = 0,
): LoanInterestQuote {
  if (!(principal > 0) || !Number.isFinite(principal)) {
    throw new Error('principal must be a positive finite number');
  }
  const interestBps = interestBpsForTerm(termMonths);
  const totalInterest = (principal * interestBps) / 10_000;
  const totalRepayment = principal + totalInterest;
  const monthlyPayment = totalRepayment / termMonths;
  const remainingBalance = Math.max(0, totalRepayment - Math.max(0, amountPaid));
  // Interest earned by the cooperative is the lesser of interest due and paid
  // after principal is protected; simple model: interest portion of payments.
  const interestEarned = Math.min(totalInterest, Math.max(0, amountPaid));

  return {
    termMonths,
    interestRatePercent: interestBps / 100,
    interestBps,
    principal,
    totalInterest,
    totalRepayment,
    monthlyPayment,
    remainingBalance,
    interestEarned,
  };
}

/** Split a repayment into interest-first then principal (pool accounting). */
export function splitRepayment(
  amount: number,
  totalInterest: number,
  interestPaid: number,
  principalRemaining: number,
): { interestPortion: number; principalPortion: number } {
  const interestRemaining = Math.max(0, totalInterest - interestPaid);
  const interestPortion = Math.min(amount, interestRemaining);
  const principalPortion = Math.min(
    Math.max(0, amount - interestPortion),
    Math.max(0, principalRemaining),
  );
  return { interestPortion, principalPortion };
}

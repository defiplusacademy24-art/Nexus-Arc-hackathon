/**
 * Cooperative loan interest policy.
 * Longer terms carry higher simple interest on principal.
 */

/** Term months → interest rate (full-term simple interest on principal). */
export const LOAN_INTEREST_TABLE: ReadonlyArray<{ months: number; rate: number; label: string }> = [
  { months: 1, rate: 0.05, label: '1 month · 5%' },
  { months: 2, rate: 0.06, label: '2 months · 6%' },
  { months: 3, rate: 0.07, label: '3 months · 7%' },
  { months: 4, rate: 0.08, label: '4 months · 8%' },
  { months: 5, rate: 0.09, label: '5 months · 9%' },
  { months: 6, rate: 0.1, label: '6 months · 10%' },
];

export function interestRateForMonths(months: number): number {
  const row = LOAN_INTEREST_TABLE.find((r) => r.months === months);
  if (row) return row.rate;
  // Clamp unknown terms into table range
  const m = Math.max(1, Math.min(6, Math.round(months)));
  return LOAN_INTEREST_TABLE.find((r) => r.months === m)?.rate ?? 0.05;
}

export function formatInterestPct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export interface LoanFinance {
  principal: number;
  interestRate: number;
  totalInterest: number;
  totalRepayment: number;
  monthlyPayment: number;
  months: number;
}

export function computeLoanFinance(principal: number, months: number): LoanFinance {
  const p = Math.max(0, principal);
  const m = Math.max(1, months);
  const interestRate = interestRateForMonths(m);
  const totalInterest = Math.round(p * interestRate * 100) / 100;
  const totalRepayment = Math.round((p + totalInterest) * 100) / 100;
  const monthlyPayment = Math.round((totalRepayment / m) * 100) / 100;
  return { principal: p, interestRate, totalInterest, totalRepayment, monthlyPayment, months: m };
}

/**
 * Split a payment into principal vs interest using remaining ratios
 * (proportional amortisation of remaining principal/interest).
 */
export function splitPayment(
  payment: number,
  remainingPrincipal: number,
  remainingInterest: number,
): { principalPortion: number; interestPortion: number } {
  const remP = Math.max(0, remainingPrincipal);
  const remI = Math.max(0, remainingInterest);
  const totalRem = remP + remI;
  if (totalRem <= 0 || payment <= 0) {
    return { principalPortion: 0, interestPortion: 0 };
  }
  const pay = Math.min(payment, totalRem);
  // Interest first for cooperative income clarity
  const interestPortion = Math.min(remI, Math.round(pay * 100) / 100);
  let left = Math.round((pay - interestPortion) * 100) / 100;
  const principalPortion = Math.min(remP, left);
  return {
    principalPortion: Math.round(principalPortion * 100) / 100,
    interestPortion: Math.round(interestPortion * 100) / 100,
  };
}

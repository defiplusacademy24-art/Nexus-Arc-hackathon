/**
 * Loan records — local helpers for finance math + legacy localStorage path.
 *
 * When `VITE_LOAN_POOL_ADDRESS` is set, the Loans UI loads / mutates loans
 * via `services/loan/pool.ts` (on-chain CooperativeLoanPool). These helpers
 * remain for remaining-balance math and offline demos without a deployed pool.
 */

import type { Loan, AiLoanAssessment, LoanPurposeCategory, Member, LoanRepaymentEntry } from '@/types';
import { decisionToLoanStatus } from './lending-agent';
import { computeLoanFinance, splitPayment } from './interest';

const key = (coopId: string) => `nexusu:loans:${coopId}`;

export function loadLoans(cooperativeId: string): Loan[] {
  try {
    const raw = localStorage.getItem(key(cooperativeId));
    return raw ? (JSON.parse(raw) as Loan[]) : [];
  } catch {
    return [];
  }
}

export function saveLoans(cooperativeId: string, loans: Loan[]): void {
  localStorage.setItem(key(cooperativeId), JSON.stringify(loans));
}

/** Ensure older loans without interest fields still repay correctly. */
export function ensureLoanFinance(loan: Loan): Loan {
  if (
    typeof loan.interestRate === 'number' &&
    typeof loan.totalRepayment === 'number' &&
    typeof loan.totalInterest === 'number'
  ) {
    return loan;
  }
  const principal = loan.approvedAmount ?? loan.requestedAmount ?? 0;
  const fin = computeLoanFinance(principal, loan.repaymentMonths || 1);
  return {
    ...loan,
    interestRate: fin.interestRate,
    totalInterest: fin.totalInterest,
    totalRepayment: fin.totalRepayment,
    monthlyPayment: fin.monthlyPayment,
  };
}

/** Total still owed (principal + interest − paid). */
export function remainingBalance(loan: Loan): number {
  const l = ensureLoanFinance(loan);
  const total = l.totalRepayment ?? (l.approvedAmount ?? l.requestedAmount ?? 0);
  const paid = l.paidAmount ?? 0;
  return Math.max(0, Math.round((total - paid) * 100) / 100);
}

/** Principal still outstanding (excludes unpaid interest). */
export function remainingPrincipal(loan: Loan): number {
  const l = ensureLoanFinance(loan);
  const principal = l.approvedAmount ?? l.requestedAmount ?? 0;
  const totalInterest = l.totalInterest ?? 0;
  const interestPaid = l.interestPaid ?? 0;
  const remainingInt = Math.max(0, totalInterest - interestPaid);
  const remTotal = remainingBalance(l);
  return Math.max(0, Math.round((remTotal - remainingInt) * 100) / 100);
}

/** Whether the loan still has principal outstanding. */
export function isOutstandingLoan(loan: Loan): boolean {
  return (
    (loan.status === 'active' || loan.status === 'approved') &&
    remainingBalance(loan) > 0
  );
}

export function outstandingLoansTotal(loans: Loan[]): number {
  return loans
    .filter(isOutstandingLoan)
    .reduce((s, l) => s + remainingBalance(l), 0);
}

export function totalDisbursedAmount(loans: Loan[]): number {
  return loans
    .filter(
      (l) =>
        l.status === 'approved' ||
        l.status === 'active' ||
        l.status === 'completed',
    )
    .reduce((s, l) => s + (l.approvedAmount ?? 0), 0);
}

export function pendingReviewCount(loans: Loan[]): number {
  return loans.filter((l) => l.status === 'pending').length;
}

export function activeLoansCount(loans: Loan[]): number {
  return loans.filter(isOutstandingLoan).length;
}

/** Simple repayment rate from completed vs defaulted (null if none closed). */
export function repaymentRate(loans: Loan[]): number | null {
  const closed = loans.filter(
    (l) => l.status === 'completed' || l.status === 'defaulted',
  );
  if (closed.length === 0) return null;
  const completed = closed.filter((l) => l.status === 'completed').length;
  return Math.round((completed / closed.length) * 1000) / 10;
}

/** Loans belonging to a wallet that still have a balance. */
export function getOutstandingLoansForWallet(
  cooperativeId: string,
  walletIdentity: string,
): Loan[] {
  const w = walletIdentity.toLowerCase().trim();
  if (!w) return [];
  return loadLoans(cooperativeId).filter(
    (l) =>
      isOutstandingLoan(l) &&
      Boolean(l.borrowerWallet) &&
      l.borrowerWallet!.toLowerCase() === w,
  );
}

export function emitLoansUpdated(cooperativeId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('nexusu:loans-updated', { detail: { cooperativeId } }),
  );
}

export interface CreateLoanInput {
  applicant: Member;
  amount: number;
  purposeCategory: LoanPurposeCategory;
  reason: string;
  repaymentMonths: number;
  assessment: AiLoanAssessment;
}

function computeDueDate(months: number, from = new Date()): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + Math.max(1, months));
  return d.toISOString();
}

export function createLoanFromAssessment(
  cooperativeId: string,
  input: CreateLoanInput,
  opts?: { cashDisbursedFromTreasury?: boolean },
): Loan {
  const { applicant, amount, purposeCategory, reason, repaymentMonths, assessment } =
    input;
  const status = decisionToLoanStatus(assessment.decision);
  const approved = assessment.decision === 'APPROVED' ? amount : undefined;
  const fin = computeLoanFinance(approved ?? amount, repaymentMonths);

  const initials =
    applicant.initials ||
    applicant.name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase() ||
    'ME';

  const disbursed =
    assessment.decision === 'APPROVED' && Boolean(opts?.cashDisbursedFromTreasury);

  const now = new Date();
  const loan: Loan = {
    id: `loan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    borrowerId: applicant.id,
    borrowerName: applicant.name,
    borrowerAvatar: applicant.avatar || '',
    borrowerInitials: initials,
    borrowerWallet: applicant.walletIdentity,
    requestedAmount: amount,
    approvedAmount: approved,
    purpose: purposeCategory,
    purposeCategory,
    reason,
    riskScore: assessment.riskScore,
    riskLevel: assessment.riskLevel,
    repaymentMonths,
    monthlyPayment: fin.monthlyPayment,
    interestRate: fin.interestRate,
    totalInterest: fin.totalInterest,
    totalRepayment: fin.totalRepayment,
    status: status === 'approved' ? 'active' : status, // live book once approved
    aiDecision: assessment.decision,
    aiRecommendation: assessment.explanation,
    aiAssessment: assessment,
    repaymentForecast: assessment.repaymentForecast,
    requestedAt: now.toISOString(),
    disbursedAt:
      assessment.decision === 'APPROVED' ? now.toISOString() : undefined,
    dueDate:
      assessment.decision === 'APPROVED'
        ? computeDueDate(repaymentMonths, now)
        : undefined,
    approvedByAi: assessment.decision === 'APPROVED',
    disbursementReady: assessment.decision === 'APPROVED',
    paidAmount: 0,
    interestPaid: 0,
    repaymentHistory: [],
    // Only true when caller actually reduced treasury cash for this principal
    cashDisbursedFromTreasury: disbursed,
    cashReturnedToTreasury: 0,
  };

  const loans = loadLoans(cooperativeId);
  saveLoans(cooperativeId, [loan, ...loans]);
  return loan;
}

export function createLoanAndNotify(
  cooperativeId: string,
  input: CreateLoanInput,
  opts?: { cashDisbursedFromTreasury?: boolean },
): Loan {
  const loan = createLoanFromAssessment(cooperativeId, input, opts);
  emitLoansUpdated(cooperativeId);
  return loan;
}

/**
 * Standard cooperative cash accounting:
 *
 *   Approve / disburse loan  → cash LEAVES treasury (treasuryBalance ↓)
 *   Member repays            → cash RETURNS to treasury (treasuryBalance ↑)
 *   Outstanding loans        → receivable (what members still owe), not cash
 *
 * Total coop economic position ≈ cash on hand + loans receivable.
 */
export function getTreasuryLoanMetrics(
  treasuryCash: number,
  loans: Loan[],
): {
  cashOnHand: number;
  loansReceivable: number;
  totalAssets: number;
  totalDisbursed: number;
  loanPoolCapacity: number;
  loanPoolAvailable: number;
} {
  const cash = Math.max(0, treasuryCash);
  const receivable = outstandingLoansTotal(loans);
  const disbursed = totalDisbursedAmount(loans);
  // Capacity is a policy share of liquid cash available for new loans
  const capacity = Math.round(cash * 0.3 * 100) / 100;
  return {
    cashOnHand: cash,
    loansReceivable: receivable,
    totalAssets: Math.round((cash + receivable) * 100) / 100,
    totalDisbursed: disbursed,
    loanPoolCapacity: capacity,
    // New loans need liquid cash; outstanding is already outside cash
    loanPoolAvailable: capacity,
  };
}

export type RepaymentResult = {
  loan: Loan;
  amountPaid: number;
  remaining: number;
  fullyPaid: boolean;
  principalPortion: number;
  interestPortion: number;
  /**
   * Principal cash restored to loan pool / treasury cash.
   * 0 when the loan never reduced cash at disbursement.
   */
  cashToRestore: number;
  /** Interest income credited as cooperative profit (always added to treasury). */
  interestToTreasury: number;
};

/**
 * Apply a partial or full repayment (principal + interest).
 *
 * Cash rules:
 * - Principal portion → restores loan-pool cash if disbursed from treasury
 * - Interest portion → cooperative profit into treasury (always)
 * - Outstanding decreases by total payment
 */
export function applyLoanRepayment(
  cooperativeId: string,
  loanId: string,
  amount: number,
  payerWallet?: string,
): RepaymentResult {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Repayment amount must be greater than zero.');
  }

  const loans = loadLoans(cooperativeId);
  const idx = loans.findIndex((l) => l.id === loanId);
  if (idx === -1) throw new Error('Loan not found.');

  let loan = ensureLoanFinance(loans[idx]);
  if (loan.status === 'completed' || loan.status === 'rejected' || loan.status === 'defaulted') {
    throw new Error('This loan cannot accept repayments.');
  }
  if (loan.status === 'pending') {
    throw new Error('Loan is still pending governance and has not been disbursed.');
  }

  if (payerWallet && loan.borrowerWallet) {
    if (loan.borrowerWallet.toLowerCase() !== payerWallet.toLowerCase()) {
      throw new Error('You can only repay your own loans.');
    }
  }

  const remaining = remainingBalance(loan);
  if (remaining <= 0) {
    throw new Error('This loan is already fully repaid.');
  }

  const pay = Math.min(amount, remaining);
  const principal = loan.approvedAmount ?? loan.requestedAmount ?? 0;
  const totalInterest = loan.totalInterest ?? 0;
  const interestPaidSoFar = loan.interestPaid ?? 0;
  const remInterest = Math.max(0, totalInterest - interestPaidSoFar);
  const remPrincipal = Math.max(0, remaining - remInterest);

  const { principalPortion, interestPortion } = splitPayment(pay, remPrincipal, remInterest);

  const newPaid = Math.round(((loan.paidAmount ?? 0) + pay) * 100) / 100;
  const newInterestPaid = Math.round((interestPaidSoFar + interestPortion) * 100) / 100;
  const totalDue = loan.totalRepayment ?? principal + totalInterest;
  const fullyPaid = newPaid >= totalDue - 0.001;

  // Principal restores cash only if disbursed from treasury
  let cashToRestore = 0;
  let cashReturned = loan.cashReturnedToTreasury ?? 0;
  if (loan.cashDisbursedFromTreasury === true && principalPortion > 0) {
    const stillUnreturned = Math.max(0, principal - cashReturned);
    cashToRestore = Math.min(principalPortion, stillUnreturned);
    cashReturned = Math.round((cashReturned + cashToRestore) * 100) / 100;
  }

  // Interest is always cooperative profit → treasury
  const interestToTreasury = interestPortion;

  const historyEntry: LoanRepaymentEntry = {
    id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: new Date().toISOString(),
    amount: pay,
    principalPortion,
    interestPortion,
    remainingAfter: Math.max(0, Math.round((totalDue - newPaid) * 100) / 100),
  };

  const updated: Loan = {
    ...loan,
    paidAmount: fullyPaid ? totalDue : newPaid,
    interestPaid: fullyPaid ? totalInterest : newInterestPaid,
    status: fullyPaid ? 'completed' : 'active',
    disbursementReady: fullyPaid ? false : loan.disbursementReady,
    cashReturnedToTreasury: cashReturned,
    repaymentHistory: [historyEntry, ...(loan.repaymentHistory ?? [])],
  };

  loans[idx] = updated;
  saveLoans(cooperativeId, loans);
  emitLoansUpdated(cooperativeId);

  return {
    loan: updated,
    amountPaid: pay,
    remaining: fullyPaid ? 0 : remainingBalance(updated),
    fullyPaid,
    principalPortion,
    interestPortion,
    cashToRestore,
    interestToTreasury,
  };
}

/**
 * Loan records — localStorage until Arc lending contracts are wired.
 * Starts empty; never seeds mock applications.
 * Supports partial and full repayment before due date.
 */

import type { Loan, AiLoanAssessment, LoanPurposeCategory, Member } from '@/types';
import { decisionToLoanStatus } from './lending-agent';

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

/** Principal still owed on a loan (never negative). */
export function remainingBalance(loan: Loan): number {
  const principal = loan.approvedAmount ?? loan.requestedAmount ?? 0;
  const paid = loan.paidAmount ?? 0;
  return Math.max(0, Math.round((principal - paid) * 100) / 100);
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
  const monthlyPayment =
    repaymentMonths > 0
      ? Math.round(((approved ?? amount) / repaymentMonths) * 100) / 100
      : amount;

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
    monthlyPayment,
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
  /**
   * Cash to add back to treasuryBalance.
   * 0 when the loan never reduced cash (legacy / earmark-only), so repay
   * cannot inflate the total treasury.
   */
  cashToRestore: number;
};

/**
 * Apply a partial or full repayment.
 *
 * Cash rules:
 * - If cash was taken from treasury at disbursement → restore the same cash on repay
 * - If cash was never taken (legacy loans) → do NOT change treasury cash
 * - Outstanding always decreases by the payment amount
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

  const loan = loans[idx];
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
  const newPaid = Math.round(((loan.paidAmount ?? 0) + pay) * 100) / 100;
  const principal = loan.approvedAmount ?? loan.requestedAmount;
  const fullyPaid = newPaid >= principal - 0.001;

  // Only restore cash that was actually taken from treasury at disbursement.
  // Legacy loans (flag missing/false) never reduced cash → cashToRestore = 0.
  let cashToRestore = 0;
  let cashReturned = loan.cashReturnedToTreasury ?? 0;
  if (loan.cashDisbursedFromTreasury === true) {
    const principalAmt = principal ?? 0;
    const stillUnreturned = Math.max(0, principalAmt - cashReturned);
    cashToRestore = Math.min(pay, stillUnreturned);
    cashReturned = Math.round((cashReturned + cashToRestore) * 100) / 100;
  }

  const updated: Loan = {
    ...loan,
    paidAmount: fullyPaid ? principal : newPaid,
    status: fullyPaid ? 'completed' : 'active',
    disbursementReady: fullyPaid ? false : loan.disbursementReady,
    cashReturnedToTreasury: cashReturned,
  };

  loans[idx] = updated;
  saveLoans(cooperativeId, loans);
  emitLoansUpdated(cooperativeId);

  return {
    loan: updated,
    amountPaid: pay,
    remaining: fullyPaid ? 0 : remainingBalance(updated),
    fullyPaid,
    cashToRestore,
  };
}

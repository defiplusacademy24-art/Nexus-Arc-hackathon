/**
 * AI Lending Agent — rule-based underwriting for cooperative loans.
 * Future: replace with on-chain Arc lending + AI agents.
 */

import type {
  AiLoanAssessment,
  AiLoanDecision,
  ContributionHistoryGrade,
  Cooperative,
  LiquidityLabel,
  Member,
  RiskLevelLabel,
  TreasuryHealthLabel,
  Loan,
} from '@/types';

/** Max share of treasury that can be requested as a single loan (policy). */
export const MAX_LOAN_TREASURY_PCT = 0.25;
/** Loan pool is modelled as 30% of treasury (matches treasury UI allocation). */
export const LOAN_POOL_PCT = 0.3;

export interface LendingContext {
  cooperative: Cooperative;
  applicant: Member;
  existingLoans: Loan[];
  requestedAmount: number;
  repaymentMonths: number;
}

function gradeContributionHistory(member: Member): ContributionHistoryGrade {
  const missed = member.missedContributions ?? 0;
  const score = member.contributionScore ?? 0;
  const status = member.contributionStatus;
  if (missed === 0 && score >= 90 && status === 'paid') return 'Excellent';
  if (missed <= 1 && score >= 75) return 'Good';
  if (missed <= 3 && score >= 50) return 'Average';
  return 'Poor';
}

function reputationScore(member: Member): number {
  // Blend reputation stars (0–5 → 0–100) with contribution score and credit score
  const fromStars = Math.round((member.reputation ?? 0) * 20);
  const contrib = member.contributionScore ?? 0;
  const credit = member.creditScore ?? 70;
  const missedPenalty = Math.min(40, (member.missedContributions ?? 0) * 12);
  const raw = Math.round(fromStars * 0.35 + contrib * 0.4 + credit * 0.25 - missedPenalty);
  return Math.max(0, Math.min(100, raw));
}

function treasuryHealth(balance: number, contributionAmount: number): TreasuryHealthLabel {
  if (balance <= 0) return 'Low';
  if (balance >= contributionAmount * 4) return 'Healthy';
  if (balance >= contributionAmount) return 'Moderate';
  return 'Low';
}

function loanPoolAvailable(treasury: number, outstanding: number): number {
  const pool = Math.max(0, treasury * LOAN_POOL_PCT);
  return Math.max(0, Math.round((pool - outstanding) * 100) / 100);
}

function liquidityLabel(available: number, requested: number): LiquidityLabel {
  if (available >= requested && available > 0) return 'Enough liquidity';
  return 'Limited liquidity';
}

function riskFromInputs(
  reputation: number,
  history: ContributionHistoryGrade,
  treasury: TreasuryHealthLabel,
  liquidity: LiquidityLabel,
  hasOutstanding: boolean,
): { level: RiskLevelLabel; score: number } {
  let score = 100 - reputation;
  if (history === 'Poor') score += 20;
  else if (history === 'Average') score += 10;
  else if (history === 'Excellent') score -= 10;
  if (treasury === 'Low') score += 15;
  else if (treasury === 'Moderate') score += 5;
  if (liquidity === 'Limited liquidity') score += 12;
  if (hasOutstanding) score += 10;
  score = Math.max(0, Math.min(100, score));
  const level: RiskLevelLabel =
    score <= 30 ? 'Low' : score <= 60 ? 'Medium' : 'High';
  return { level, score };
}

function decide(input: {
  reputation: number;
  history: ContributionHistoryGrade;
  liquidity: LiquidityLabel;
  requested: number;
  maxAllowed: number;
  treasury: TreasuryHealthLabel;
  missed: number;
}): { decision: AiLoanDecision; explanation: string } {
  const {
    reputation, history, liquidity, requested, maxAllowed, treasury, missed,
  } = input;

  if (reputation < 60 || history === 'Poor' || missed >= 4) {
    return {
      decision: 'DECLINED',
      explanation:
        missed >= 2
          ? 'This member has missed recent contributions and currently exceeds the cooperative debt threshold.'
          : 'This member’s reputation and contribution history fall below cooperative lending standards. The request is declined.',
    };
  }

  if (requested > maxAllowed && maxAllowed > 0) {
    return {
      decision: 'REQUIRES_GOVERNANCE_REVIEW',
      explanation:
        'This request exceeds the current lending limit. Governance review is required.',
    };
  }

  if (liquidity === 'Limited liquidity' || treasury === 'Low') {
    return {
      decision: 'REQUIRES_GOVERNANCE_REVIEW',
      explanation:
        'Treasury liquidity is constrained relative to the request. Governance review is required before disbursement.',
    };
  }

  if (reputation >= 85 && (history === 'Excellent' || history === 'Good') && liquidity === 'Enough liquidity' && requested <= maxAllowed) {
    return {
      decision: 'APPROVED',
      explanation:
        'This member has contributed consistently, has an acceptable debt profile, and the cooperative treasury has sufficient liquidity. The requested amount falls within lending policy.',
    };
  }

  if (reputation >= 60 && reputation <= 84) {
    return {
      decision: 'REQUIRES_GOVERNANCE_REVIEW',
      explanation:
        'Member reputation is in the mid range (60–84). Per policy this application requires governance review before approval.',
    };
  }

  // Edge: high reputation but mixed history
  if (reputation >= 85) {
    return {
      decision: 'APPROVED',
      explanation:
        'Strong member reputation and acceptable risk profile. Approved within cooperative lending rules.',
    };
  }

  return {
    decision: 'DECLINED',
    explanation:
      'Automated rules could not approve this request. Contribution history or risk metrics fall short of policy.',
  };
}

/**
 * Run AI Lending Agent assessment (pure, synchronous).
 * UI should delay 2–3s to simulate agent processing.
 */
export function evaluateLoanApplication(ctx: LendingContext): AiLoanAssessment {
  const { cooperative, applicant, existingLoans, requestedAmount, repaymentMonths } = ctx;
  const treasury = cooperative.treasuryBalance ?? 0;
  const contributionAmount = cooperative.contributionAmount || 1;

  const outstandingLoans = existingLoans.filter(
    (l) =>
      (l.borrowerWallet?.toLowerCase() === applicant.walletIdentity.toLowerCase() ||
        l.borrowerId === applicant.id) &&
      (l.status === 'active' || l.status === 'approved'),
  );
  const outstandingBalance = outstandingLoans.reduce((s, l) => {
    const principal = l.approvedAmount ?? l.requestedAmount ?? 0;
    const paid = l.paidAmount ?? 0;
    return s + Math.max(0, principal - paid);
  }, 0);
  const coopOutstanding = existingLoans
    .filter((l) => l.status === 'active' || l.status === 'approved')
    .reduce((s, l) => {
      const principal = l.approvedAmount ?? l.requestedAmount ?? 0;
      const paid = l.paidAmount ?? 0;
      return s + Math.max(0, principal - paid);
    }, 0);

  const poolAvail = loanPoolAvailable(treasury, coopOutstanding);
  const maxAllowed = Math.round(
    Math.min(treasury * MAX_LOAN_TREASURY_PCT, poolAvail > 0 ? poolAvail : treasury * MAX_LOAN_TREASURY_PCT) * 100,
  ) / 100;

  const history = gradeContributionHistory(applicant);
  const reputation = reputationScore(applicant);
  const tHealth = treasuryHealth(treasury, contributionAmount);
  const liq = liquidityLabel(poolAvail, requestedAmount);
  const { level, score } = riskFromInputs(
    reputation,
    history,
    tHealth,
    liq,
    outstandingBalance > 0,
  );

  const { decision, explanation } = decide({
    reputation,
    history,
    liquidity: liq,
    requested: requestedAmount,
    maxAllowed: maxAllowed > 0 ? maxAllowed : treasury * MAX_LOAN_TREASURY_PCT,
    treasury: tHealth,
    missed: applicant.missedContributions ?? 0,
  });

  const repaymentForecast = Math.max(
    40,
    Math.min(99, Math.round(55 + reputation * 0.4 - score * 0.15 + (repaymentMonths <= 3 ? 5 : 0))),
  );

  return {
    contributionHistory: history,
    memberReputation: reputation,
    treasuryHealth: tHealth,
    loanPoolLiquidity: liq,
    outstandingLoansLabel:
      outstandingBalance <= 0
        ? 'None'
        : `Current balance ${outstandingBalance.toLocaleString(undefined, { style: 'currency', currency: cooperative.currency || 'USD', maximumFractionDigits: 0 })}`,
    outstandingBalance,
    requestedAmount,
    riskLevel: level,
    riskScore: score,
    decision,
    explanation,
    repaymentForecast,
    maxAllowedAmount: maxAllowed,
    loanPoolAvailable: poolAvail,
  };
}

export function decisionToLoanStatus(decision: AiLoanDecision): 'approved' | 'pending' | 'rejected' {
  if (decision === 'APPROVED') return 'approved';
  if (decision === 'DECLINED') return 'rejected';
  return 'pending'; // governance review
}

export function decisionBadgeLabel(decision: AiLoanDecision): string {
  switch (decision) {
    case 'APPROVED':
      return 'Approved';
    case 'REQUIRES_GOVERNANCE_REVIEW':
      return 'Pending Governance';
    case 'DECLINED':
      return 'Declined';
  }
}

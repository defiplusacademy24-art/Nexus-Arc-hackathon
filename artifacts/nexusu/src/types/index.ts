// ── Cooperative ────────────────────────────────────────────────────────────────

export type CoopType = 'Esusu' | 'Ajo' | 'Chama' | 'Stokvel' | 'Susu' | 'ROSCA' | 'SACCO' | 'General' | 'Other';
/** Lifecycle: draft → open → active → completed. Legacy 'inactive'/'pending' still accepted. */
export type CoopStatus = 'draft' | 'open' | 'active' | 'completed' | 'inactive' | 'pending';
export type ContributionFrequency = 'weekly' | 'bi-weekly' | 'monthly';
export type CoopPrivacy = 'public' | 'private' | 'invite-only';
export type VotingModel = 'simple-majority' | 'supermajority' | 'unanimous';
export type LoanApprovalPolicy = 'admin-only' | 'member-vote' | 'ai-recommended' | 'hybrid';

/**
 * Payout rotation strategy.
 * Only JOIN_ORDER is implemented for MVP.
 * RANDOM, ORGANIZER_ASSIGNED, GOVERNANCE_VOTE are reserved for later.
 */
export type RotationMode =
  | 'JOIN_ORDER'
  | 'RANDOM'
  | 'ORGANIZER_ASSIGNED'
  | 'GOVERNANCE_VOTE';

export const DEFAULT_ROTATION_MODE: RotationMode = 'JOIN_ORDER';

export interface Cooperative {
  id: string;
  name: string;
  type: CoopType;
  country: string;
  currency: string;
  memberCount: number;
  treasuryBalance: number;
  contributionAmount: number;
  contributionFrequency: ContributionFrequency;
  walletIdentity: string;
  status: CoopStatus;
  governanceScore: number;
  aiHealthScore: number;
  createdAt: string;
  description: string;
  // Governance & rules (optional for backward compat)
  privacy?: CoopPrivacy;
  votingModel?: VotingModel;
  approvalThreshold?: number;
  loanApprovalPolicy?: LoanApprovalPolicy;
  aiGovernanceEnabled?: boolean;
  maxMembers?: number;
  /** Payout strategy — default JOIN_ORDER */
  rotationMode?: RotationMode;
  /** Current cycle recipient join position (1-based). Set on activation. */
  currentRecipientPosition?: number;
  /** Contribution cycle counter (1-based). Advances with payouts. */
  currentCycle?: number;
  /**
   * Isolated on-chain CooperativeTreasuryVault for this workspace only.
   * Each cooperative must have its own vault — never share across workspaces.
   */
  treasuryVaultAddress?: string | null;
  /**
   * Isolated CooperativeLoanPool for this workspace (30% of vault deposits).
   * Never share one pool across cooperatives.
   */
  loanPoolAddress?: string | null;
  // Identity
  inviteCode?: string;
  cooperativeId?: string;
  /** Server-side cooperative id (may differ from local `id` when dual-stored). */
  backendId?: string;
  founderWalletIdentity?: string;
}

// ── Member ─────────────────────────────────────────────────────────────────────

export type MemberRole = 'founder' | 'admin' | 'treasurer' | 'secretary' | 'auditor' | 'member';
export type MemberStatus = 'active' | 'inactive' | 'suspended';
/** Per-cycle contribution state for ROSCA-style groups */
export type ContributionStatus =
  | 'waiting'
  | 'pending'
  | 'paid'
  | 'overdue'
  | 'exempt';

export interface Member {
  id: string;
  name: string;
  email: string;
  avatar: string;
  initials: string;
  walletIdentity: string;
  role: MemberRole;
  contributionScore: number;  // 0–100
  riskScore: number;          // 0–100 (lower = less risky)
  reputation: number;         // 0–5
  status: MemberStatus;
  joinedAt: string;
  totalContributed: number;
  missedContributions: number;
  activeLoans: number;
  /** Permanent payout order position (1-based). Never reordered after assignment. */
  joinPosition?: number;
  /** Current contribution cycle status */
  contributionStatus?: ContributionStatus;
  /** Whether this member has already received their pooled payout */
  hasReceivedPayout?: boolean;
  /** Placeholder credit score (0–100) for future AI lending agents */
  creditScore?: number;
}

export interface MemberActivity {
  id: string;
  memberId: string;
  type: 'contribution' | 'loan' | 'vote' | 'join';
  description: string;
  amount?: number;
  date: string;
}

// ── Treasury ───────────────────────────────────────────────────────────────────

export interface TreasurySnapshot {
  /** @deprecated Prefer rotationFund — 60% of cash */
  availableBalance: number;
  /** Rotation fund (60% of cash on hand) */
  rotationFund: number;
  reservedFunds: number;
  loanPool: number;
  emergencyReserve: number;
  savingsInvestment: number;
  pendingContributions: number;
  monthlyInflow: number;
  monthlyOutflow: number;
  netFlow: number;
}

export interface CashFlowPoint {
  month: string;
  inflow: number;
  outflow: number;
  balance: number;
}

// ── Savings ────────────────────────────────────────────────────────────────────

export type SavingsStatus = 'active' | 'completed' | 'paused';

/** @deprecated Personal pools removed — cooperative Savings Vault only */
export interface SavingsPool {
  id: string;
  name: string;
  contributionAmount: number;
  frequency: ContributionFrequency;
  memberIds: string[];
  balance: number;
  target: number;
  nextContributionDate: string;
  progress: number; // 0–100
  status: SavingsStatus;
  aiRecommendation: string;
}

/** Cooperative Savings Vault lifecycle status */
export type SavingsVaultStatus = 'active' | 'growing' | 'paused';

export type SavingsLedgerKind =
  | 'allocation'
  | 'interest'
  | 'profit_return'
  | 'rebalance';

export interface SavingsLedgerEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  kind: SavingsLedgerKind;
  status: 'completed' | 'pending';
}

export interface SavingsGrowthPoint {
  label: string;
  savings: number;
  yield: number;
  treasury: number;
}

export interface SavingsVaultSnapshot {
  totalSavings: number;
  allocationPct: number;
  yieldEarned: number;
  status: SavingsVaultStatus;
  treasuryCash: number;
  rotationFund: number;
  loanPool: number;
  emergencyReserve: number;
  savingsVault: number;
  ledger: SavingsLedgerEntry[];
  growth: SavingsGrowthPoint[];
  insights: string[];
  projectedAnnualGrowthPct: number;
  nextReviewDays: number;
  treasuryHealth: 'Healthy' | 'Moderate' | 'Low';
  riskLevel: 'Low' | 'Medium' | 'High';
  recommendation: string;
  recentDecision: string;
}

// ── Loans ──────────────────────────────────────────────────────────────────────

export type LoanStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'completed'
  | 'defaulted';

/** AI Lending Agent underwriting decision */
export type AiLoanDecision = 'APPROVED' | 'REQUIRES_GOVERNANCE_REVIEW' | 'DECLINED';

export type LoanPurposeCategory =
  | 'Business'
  | 'Education'
  | 'Emergency'
  | 'Medical'
  | 'Agriculture'
  | 'Personal'
  | 'Other';

export type ContributionHistoryGrade = 'Excellent' | 'Good' | 'Average' | 'Poor';
export type TreasuryHealthLabel = 'Healthy' | 'Moderate' | 'Low';
export type LiquidityLabel = 'Enough liquidity' | 'Limited liquidity';
export type RiskLevelLabel = 'Low' | 'Medium' | 'High';

export interface AiLoanAssessment {
  contributionHistory: ContributionHistoryGrade;
  memberReputation: number; // 0–100
  treasuryHealth: TreasuryHealthLabel;
  loanPoolLiquidity: LiquidityLabel;
  outstandingLoansLabel: string;
  outstandingBalance: number;
  requestedAmount: number;
  riskLevel: RiskLevelLabel;
  riskScore: number; // 0–100 higher = riskier
  decision: AiLoanDecision;
  explanation: string;
  repaymentForecast: number;
  maxAllowedAmount: number;
  loanPoolAvailable: number;
}

export interface LoanRepaymentEntry {
  id: string;
  date: string;
  amount: number;
  principalPortion: number;
  interestPortion: number;
  remainingAfter: number;
  note?: string;
}

export interface Loan {
  id: string;
  borrowerId: string;
  borrowerName: string;
  borrowerAvatar: string;
  borrowerInitials: string;
  borrowerWallet?: string;
  requestedAmount: number;
  approvedAmount?: number;
  purpose: string;
  purposeCategory?: LoanPurposeCategory;
  reason?: string;
  riskScore: number;
  riskLevel?: RiskLevelLabel;
  repaymentMonths: number;
  monthlyPayment: number;
  /** Simple interest rate for the full term (e.g. 0.07 = 7%). */
  interestRate?: number;
  /** Principal + interest due over the full term. */
  totalRepayment?: number;
  /** Interest portion of total repayment. */
  totalInterest?: number;
  status: LoanStatus;
  /** pending = governance review; approved = AI approved; rejected = declined */
  aiDecision?: AiLoanDecision;
  aiRecommendation: string;
  aiAssessment?: AiLoanAssessment;
  repaymentForecast: number; // % likely to repay
  requestedAt: string;
  disbursedAt?: string;
  dueDate?: string;
  paidAmount?: number;
  /** Interest portion already collected via repayments. */
  interestPaid?: number;
  repaymentHistory?: LoanRepaymentEntry[];
  approvedByAi?: boolean;
  disbursementReady?: boolean;
  /**
   * True only when principal was deducted from cooperative cash on disbursement.
   * Repayments restore cash only if this is true — prevents double-counting when
   * older loans never reduced treasury.
   */
  cashDisbursedFromTreasury?: boolean;
  /** How much principal has already been restored to cash via repayments. */
  cashReturnedToTreasury?: number;
}

// ── Governance ─────────────────────────────────────────────────────────────────

export type ProposalStatus = 'active' | 'passed' | 'rejected' | 'expired';
export type ProposalType = 'policy' | 'financial' | 'membership' | 'emergency';

export interface Proposal {
  id: string;
  title: string;
  description: string;
  type: ProposalType;
  proposerId: string;
  proposerName: string;
  proposerInitials: string;
  status: ProposalStatus;
  votesFor: number;
  votesAgainst: number;
  abstain: number;
  totalVotes: number;
  requiredVotes: number;
  deadline: string;
  createdAt: string;
  aiInsight: string;
}

// ── Notifications ──────────────────────────────────────────────────────────────

export type NotifType =
  | 'contribution'
  | 'deposit'
  | 'withdrawal'
  | 'loan'
  | 'proposal'
  | 'vote'
  | 'member'
  | 'ai'
  | 'treasury'
  | 'warning';

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  actionLabel?: string;
  actionHref?: string;
  coopId?: string | null;
  metadata?: Record<string, unknown>;
}

// ── AI ─────────────────────────────────────────────────────────────────────────

export type AIRole = 'user' | 'nexa';

export interface AIMessage {
  id: string;
  role: AIRole;
  content: string;
  timestamp: string;
}

export interface AIInsight {
  id: string;
  category: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'success' | 'alert';
  timestamp: string;
}

// ── Analytics ──────────────────────────────────────────────────────────────────

export interface ChartPoint {
  label: string;
  value: number;
  secondary?: number;
}

// ── Cooperative ────────────────────────────────────────────────────────────────

export type CoopType = 'Esusu' | 'Ajo' | 'Chama' | 'Stokvel' | 'Susu' | 'ROSCA' | 'General';
export type CoopStatus = 'active' | 'inactive' | 'pending';
export type ContributionFrequency = 'weekly' | 'bi-weekly' | 'monthly';

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
}

// ── Member ─────────────────────────────────────────────────────────────────────

export type MemberRole = 'admin' | 'treasurer' | 'secretary' | 'member';
export type MemberStatus = 'active' | 'inactive' | 'suspended';

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
  availableBalance: number;
  reservedFunds: number;
  loanPool: number;
  emergencyReserve: number;
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

// ── Loans ──────────────────────────────────────────────────────────────────────

export type LoanStatus = 'pending' | 'approved' | 'rejected' | 'active' | 'completed' | 'defaulted';

export interface Loan {
  id: string;
  borrowerId: string;
  borrowerName: string;
  borrowerAvatar: string;
  borrowerInitials: string;
  requestedAmount: number;
  approvedAmount?: number;
  purpose: string;
  riskScore: number;
  repaymentMonths: number;
  monthlyPayment: number;
  status: LoanStatus;
  aiRecommendation: string;
  repaymentForecast: number; // % likely to repay
  requestedAt: string;
  disbursedAt?: string;
  dueDate?: string;
  paidAmount?: number;
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

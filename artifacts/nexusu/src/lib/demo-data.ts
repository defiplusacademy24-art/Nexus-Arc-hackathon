/**
 * Realistic demo data for the Nexusu Cooperative OS.
 * Represents Sunshine Savings Cooperative — a fictional but realistic example.
 */

import type {
  Cooperative, Member, SavingsPool, Loan,
  Proposal, AppNotification, AIMessage,
} from '@/types';

// ── Cooperative ────────────────────────────────────────────────────────────────

export const DEMO_COOPERATIVE: Cooperative = {
  id: 'coop-001',
  name: 'Sunshine Savings Cooperative',
  type: 'Stokvel',
  country: 'South Africa',
  currency: 'USD',
  memberCount: 25,
  treasuryBalance: 45_280,
  contributionAmount: 350,
  contributionFrequency: 'monthly',
  walletIdentity: 'DIRECT://0000a7f3c9e1b2d4a8f0c6e2b4d8a0f2c4e6b8d0a2c4e6b8d0a2c4e6',
  status: 'active',
  governanceScore: 87,
  aiHealthScore: 92,
  createdAt: '2024-01-15',
  description:
    'A community savings cooperative empowering members through collective finance, mutual credit, and AI-powered governance.',
};

// ── Members (25) ───────────────────────────────────────────────────────────────

const memberData: Omit<Member, 'id' | 'walletIdentity'>[] = [
  { name: 'Grace Mensah', email: 'grace@example.com', avatar: '', initials: 'GM', role: 'admin', contributionScore: 98, riskScore: 12, reputation: 5, status: 'active', joinedAt: '2024-01-15', totalContributed: 6_300, missedContributions: 0, activeLoans: 0 },
  { name: 'Kwame Asante', email: 'kwame@example.com', avatar: '', initials: 'KA', role: 'treasurer', contributionScore: 96, riskScore: 15, reputation: 5, status: 'active', joinedAt: '2024-01-15', totalContributed: 6_120, missedContributions: 0, activeLoans: 1 },
  { name: 'Fatima Diallo', email: 'fatima@example.com', avatar: '', initials: 'FD', role: 'secretary', contributionScore: 94, riskScore: 18, reputation: 4.8, status: 'active', joinedAt: '2024-02-01', totalContributed: 5_880, missedContributions: 0, activeLoans: 0 },
  { name: 'John Mensah', email: 'john@example.com', avatar: '', initials: 'JM', role: 'member', contributionScore: 92, riskScore: 22, reputation: 4.7, status: 'active', joinedAt: '2024-02-10', totalContributed: 5_760, missedContributions: 0, activeLoans: 1 },
  { name: 'Amina Kofi', email: 'amina@example.com', avatar: '', initials: 'AK', role: 'member', contributionScore: 90, riskScore: 24, reputation: 4.6, status: 'active', joinedAt: '2024-02-15', totalContributed: 5_600, missedContributions: 1, activeLoans: 0 },
  { name: 'Ibrahim Traore', email: 'ibrahim@example.com', avatar: '', initials: 'IT', role: 'member', contributionScore: 88, riskScore: 28, reputation: 4.5, status: 'active', joinedAt: '2024-03-01', totalContributed: 5_250, missedContributions: 1, activeLoans: 0 },
  { name: 'Chioma Eze', email: 'chioma@example.com', avatar: '', initials: 'CE', role: 'member', contributionScore: 86, riskScore: 31, reputation: 4.4, status: 'active', joinedAt: '2024-03-10', totalContributed: 5_040, missedContributions: 1, activeLoans: 0 },
  { name: 'Yaw Darko', email: 'yaw@example.com', avatar: '', initials: 'YD', role: 'member', contributionScore: 85, riskScore: 29, reputation: 4.3, status: 'active', joinedAt: '2024-03-15', totalContributed: 4_900, missedContributions: 1, activeLoans: 1 },
  { name: 'Zainab Kamara', email: 'zainab@example.com', avatar: '', initials: 'ZK', role: 'member', contributionScore: 83, riskScore: 33, reputation: 4.2, status: 'active', joinedAt: '2024-04-01', totalContributed: 4_620, missedContributions: 1, activeLoans: 0 },
  { name: 'Samuel Osei', email: 'samuel@example.com', avatar: '', initials: 'SO', role: 'member', contributionScore: 82, riskScore: 35, reputation: 4.1, status: 'active', joinedAt: '2024-04-10', totalContributed: 4_480, missedContributions: 2, activeLoans: 0 },
  { name: 'Adaeze Okonkwo', email: 'adaeze@example.com', avatar: '', initials: 'AO', role: 'member', contributionScore: 80, riskScore: 37, reputation: 4.0, status: 'active', joinedAt: '2024-04-15', totalContributed: 4_200, missedContributions: 2, activeLoans: 0 },
  { name: 'Moussa Coulibaly', email: 'moussa@example.com', avatar: '', initials: 'MC', role: 'member', contributionScore: 79, riskScore: 38, reputation: 3.9, status: 'active', joinedAt: '2024-05-01', totalContributed: 3_850, missedContributions: 2, activeLoans: 0 },
  { name: 'Akosua Boateng', email: 'akosua@example.com', avatar: '', initials: 'AB', role: 'member', contributionScore: 77, riskScore: 40, reputation: 3.8, status: 'active', joinedAt: '2024-05-10', totalContributed: 3_640, missedContributions: 2, activeLoans: 0 },
  { name: 'Emeka Nwosu', email: 'emeka@example.com', avatar: '', initials: 'EN', role: 'member', contributionScore: 76, riskScore: 42, reputation: 3.7, status: 'active', joinedAt: '2024-05-15', totalContributed: 3_500, missedContributions: 3, activeLoans: 0 },
  { name: 'Kemi Adeyemi', email: 'kemi@example.com', avatar: '', initials: 'KA', role: 'member', contributionScore: 74, riskScore: 44, reputation: 3.6, status: 'active', joinedAt: '2024-06-01', totalContributed: 3_150, missedContributions: 2, activeLoans: 0 },
  { name: 'Kofi Agyeman', email: 'kofi@example.com', avatar: '', initials: 'KA', role: 'member', contributionScore: 72, riskScore: 46, reputation: 3.5, status: 'active', joinedAt: '2024-06-10', totalContributed: 2_940, missedContributions: 3, activeLoans: 0 },
  { name: 'Blessing Okeke', email: 'blessing@example.com', avatar: '', initials: 'BO', role: 'member', contributionScore: 71, riskScore: 47, reputation: 3.4, status: 'active', joinedAt: '2024-06-15', totalContributed: 2_800, missedContributions: 3, activeLoans: 0 },
  { name: 'Nana Adjoa', email: 'nana@example.com', avatar: '', initials: 'NA', role: 'member', contributionScore: 70, riskScore: 49, reputation: 3.3, status: 'active', joinedAt: '2024-07-01', totalContributed: 2_450, missedContributions: 3, activeLoans: 0 },
  { name: 'Ife Adeleke', email: 'ife@example.com', avatar: '', initials: 'IA', role: 'member', contributionScore: 68, riskScore: 51, reputation: 3.2, status: 'active', joinedAt: '2024-07-10', totalContributed: 2_240, missedContributions: 3, activeLoans: 0 },
  { name: 'Seun Balogun', email: 'seun@example.com', avatar: '', initials: 'SB', role: 'member', contributionScore: 67, riskScore: 53, reputation: 3.1, status: 'active', joinedAt: '2024-07-15', totalContributed: 2_100, missedContributions: 3, activeLoans: 0 },
  { name: 'Abena Frimpong', email: 'abena@example.com', avatar: '', initials: 'AF', role: 'member', contributionScore: 65, riskScore: 55, reputation: 3.0, status: 'active', joinedAt: '2024-08-01', totalContributed: 1_750, missedContributions: 4, activeLoans: 0 },
  { name: 'Tunde Afolabi', email: 'tunde@example.com', avatar: '', initials: 'TA', role: 'member', contributionScore: 63, riskScore: 57, reputation: 2.9, status: 'active', joinedAt: '2024-08-10', totalContributed: 1_560, missedContributions: 4, activeLoans: 0 },
  { name: 'David Okafor', email: 'david@example.com', avatar: '', initials: 'DO', role: 'member', contributionScore: 62, riskScore: 58, reputation: 2.8, status: 'active', joinedAt: '2024-08-15', totalContributed: 1_400, missedContributions: 1, activeLoans: 0 },
  { name: 'Amara Nwosu', email: 'amara@example.com', avatar: '', initials: 'AN', role: 'member', contributionScore: 44, riskScore: 72, reputation: 2.2, status: 'active', joinedAt: '2024-09-01', totalContributed: 980, missedContributions: 2, activeLoans: 0 },
  { name: 'Chidi Obi', email: 'chidi@example.com', avatar: '', initials: 'CO', role: 'member', contributionScore: 70, riskScore: 48, reputation: 3.3, status: 'inactive', joinedAt: '2024-09-10', totalContributed: 1_050, missedContributions: 3, activeLoans: 0 },
];

export const DEMO_MEMBERS: Member[] = memberData.map((m, i) => ({
  ...m,
  id: `member-${String(i + 1).padStart(3, '0')}`,
  walletIdentity: `DIRECT://0000${Math.random().toString(16).slice(2, 18)}${Math.random().toString(16).slice(2, 18)}`,
}));

// ── Savings Pools ──────────────────────────────────────────────────────────────

export const DEMO_SAVINGS_POOLS: SavingsPool[] = [
  {
    id: 'pool-001',
    name: 'Main Monthly Stokvel',
    contributionAmount: 350,
    frequency: 'monthly',
    memberIds: DEMO_MEMBERS.slice(0, 20).map((m) => m.id),
    balance: 28_500,
    target: 35_000,
    nextContributionDate: '2026-07-31',
    progress: 81,
    status: 'active',
    aiRecommendation: 'On track to reach target by August. Increase to $400/month to hit $40K by year-end.',
  },
  {
    id: 'pool-002',
    name: 'Emergency Fund',
    contributionAmount: 50,
    frequency: 'monthly',
    memberIds: DEMO_MEMBERS.slice(0, 25).map((m) => m.id),
    balance: 4_780,
    target: 7_500,
    nextContributionDate: '2026-07-31',
    progress: 64,
    status: 'active',
    aiRecommendation: 'Below the recommended 15% of treasury. Increase contributions by $20/member to close gap.',
  },
  {
    id: 'pool-003',
    name: 'Business Development Pool',
    contributionAmount: 100,
    frequency: 'monthly',
    memberIds: DEMO_MEMBERS.slice(0, 10).map((m) => m.id),
    balance: 3_200,
    target: 10_000,
    nextContributionDate: '2026-07-31',
    progress: 32,
    status: 'active',
    aiRecommendation: 'Good start. At current rate, target reached in 7 months. Consider adding 5 more members.',
  },
  {
    id: 'pool-004',
    name: 'Holiday Fund 2026',
    contributionAmount: 80,
    frequency: 'monthly',
    memberIds: DEMO_MEMBERS.slice(5, 18).map((m) => m.id),
    balance: 2_400,
    target: 3_120,
    nextContributionDate: '2026-11-30',
    progress: 77,
    status: 'active',
    aiRecommendation: 'On track for December payout. No changes needed.',
  },
];

// ── Loans ──────────────────────────────────────────────────────────────────────

export const DEMO_LOANS: Loan[] = [
  {
    id: 'loan-001',
    borrowerId: 'member-002',
    borrowerName: 'Kwame Asante',
    borrowerAvatar: '',
    borrowerInitials: 'KA',
    requestedAmount: 3_000,
    approvedAmount: 3_000,
    purpose: 'Inventory purchase for retail business',
    riskScore: 15,
    repaymentMonths: 12,
    monthlyPayment: 265,
    status: 'active',
    aiRecommendation: 'Approved. Excellent credit history. High repayment likelihood.',
    repaymentForecast: 98,
    requestedAt: '2026-02-01',
    disbursedAt: '2026-02-10',
    dueDate: '2027-02-10',
    paidAmount: 1_325,
  },
  {
    id: 'loan-002',
    borrowerId: 'member-004',
    borrowerName: 'John Mensah',
    borrowerAvatar: '',
    borrowerInitials: 'JM',
    requestedAmount: 2_500,
    approvedAmount: 2_500,
    purpose: 'Mobile food vendor expansion',
    riskScore: 22,
    repaymentMonths: 12,
    monthlyPayment: 221,
    status: 'active',
    aiRecommendation: 'Approved. Strong contribution record. Business case is sound.',
    repaymentForecast: 96,
    requestedAt: '2026-03-15',
    disbursedAt: '2026-03-20',
    dueDate: '2027-03-20',
    paidAmount: 884,
  },
  {
    id: 'loan-003',
    borrowerId: 'member-008',
    borrowerName: 'Yaw Darko',
    borrowerAvatar: '',
    borrowerInitials: 'YD',
    requestedAmount: 1_500,
    approvedAmount: 1_500,
    purpose: 'School fees — university tuition',
    riskScore: 29,
    repaymentMonths: 8,
    monthlyPayment: 196,
    status: 'active',
    aiRecommendation: 'Approved. Education loans have high social ROI. Low risk.',
    repaymentForecast: 94,
    requestedAt: '2026-04-01',
    disbursedAt: '2026-04-05',
    dueDate: '2026-12-05',
    paidAmount: 588,
  },
  {
    id: 'loan-004',
    borrowerId: 'member-005',
    borrowerName: 'Amina Kofi',
    borrowerAvatar: '',
    borrowerInitials: 'AK',
    requestedAmount: 4_000,
    purpose: 'Salon equipment purchase',
    riskScore: 24,
    repaymentMonths: 18,
    monthlyPayment: 238,
    status: 'pending',
    aiRecommendation: 'Recommend approval at $3,500. Strong history, purpose is viable. Slight reduction advised given current loan pool utilisation.',
    repaymentForecast: 91,
    requestedAt: '2026-06-28',
  },
  {
    id: 'loan-005',
    borrowerId: 'member-024',
    borrowerName: 'Amara Nwosu',
    borrowerAvatar: '',
    borrowerInitials: 'AN',
    requestedAmount: 2_000,
    purpose: 'Medical emergency',
    riskScore: 72,
    repaymentMonths: 12,
    monthlyPayment: 177,
    status: 'pending',
    aiRecommendation: 'Caution. 2 missed contributions and high risk score. Recommend review meeting before approval. Consider smaller amount ($800) with shorter term.',
    repaymentForecast: 64,
    requestedAt: '2026-06-30',
  },
  {
    id: 'loan-006',
    borrowerId: 'member-010',
    borrowerName: 'Samuel Osei',
    borrowerAvatar: '',
    borrowerInitials: 'SO',
    requestedAmount: 1_200,
    approvedAmount: 1_200,
    purpose: 'Motorcycle repair — primary income vehicle',
    riskScore: 35,
    repaymentMonths: 6,
    monthlyPayment: 212,
    status: 'completed',
    aiRecommendation: 'Fully repaid. Excellent outcome. Eligible for larger loan.',
    repaymentForecast: 100,
    requestedAt: '2025-09-01',
    disbursedAt: '2025-09-05',
    dueDate: '2026-03-05',
    paidAmount: 1_200,
  },
];

// ── Governance Proposals ───────────────────────────────────────────────────────

export const DEMO_PROPOSALS: Proposal[] = [
  {
    id: 'prop-001',
    title: 'Increase Loan Ceiling to $4,000',
    description: 'Proposal to raise the maximum individual loan amount from $3,000 to $4,000 for members with a contribution score above 85. This will benefit 8 eligible members and increase loan pool utilisation by an estimated 22%.',
    type: 'financial',
    proposerId: 'member-001',
    proposerName: 'Grace Mensah',
    proposerInitials: 'GM',
    status: 'active',
    votesFor: 14,
    votesAgainst: 4,
    abstain: 2,
    totalVotes: 20,
    requiredVotes: 16,
    deadline: '2026-07-07',
    createdAt: '2026-06-24',
    aiInsight: 'Likely to pass. 67% approval with 5 days remaining. Financial impact is positive given current treasury health.',
  },
  {
    id: 'prop-002',
    title: 'Establish Emergency Fund Policy',
    description: 'Formalise a policy requiring the Emergency Reserve to maintain a minimum of 15% of total treasury balance. Monthly top-ups would be automated when balance falls below threshold.',
    type: 'policy',
    proposerId: 'member-002',
    proposerName: 'Kwame Asante',
    proposerInitials: 'KA',
    status: 'active',
    votesFor: 11,
    votesAgainst: 2,
    abstain: 3,
    totalVotes: 16,
    requiredVotes: 16,
    deadline: '2026-07-14',
    createdAt: '2026-06-28',
    aiInsight: 'Strong support. Aligns with best practices for cooperative risk management.',
  },
  {
    id: 'prop-003',
    title: 'Admit 5 New Members — Batch 3',
    description: 'Approve the admission of 5 new applicants who have completed the orientation programme and submitted required documentation.',
    type: 'membership',
    proposerId: 'member-003',
    proposerName: 'Fatima Diallo',
    proposerInitials: 'FD',
    status: 'passed',
    votesFor: 19,
    votesAgainst: 2,
    abstain: 1,
    totalVotes: 22,
    requiredVotes: 16,
    deadline: '2026-06-15',
    createdAt: '2026-06-01',
    aiInsight: 'Passed with 86% approval. New members will increase monthly inflow by $1,750.',
  },
  {
    id: 'prop-004',
    title: 'Quarterly Treasurer Report — Q1 2026',
    description: 'Ratify the Q1 2026 treasury report as presented by Kwame Asante. Report shows 12.4% growth and full compliance with contribution targets.',
    type: 'financial',
    proposerId: 'member-002',
    proposerName: 'Kwame Asante',
    proposerInitials: 'KA',
    status: 'passed',
    votesFor: 23,
    votesAgainst: 0,
    abstain: 2,
    totalVotes: 25,
    requiredVotes: 16,
    deadline: '2026-04-15',
    createdAt: '2026-04-01',
    aiInsight: 'Unanimous pass. Strong governance outcome.',
  },
];

// ── Notifications ──────────────────────────────────────────────────────────────

export const DEMO_NOTIFICATIONS: AppNotification[] = [
  { id: 'notif-001', type: 'contribution', title: 'Contribution received', description: 'Grace Mensah contributed $350 — July 2026', timestamp: '2026-07-01T08:12:00Z', read: false },
  { id: 'notif-002', type: 'ai', title: 'Nexa AI Insight', description: 'Treasury projected to reach $60K by Q3 at current growth rate.', timestamp: '2026-07-01T07:00:00Z', read: false, actionLabel: 'View Treasury', actionHref: '/dashboard/treasury' },
  { id: 'notif-003', type: 'loan', title: 'New loan application', description: 'Amara Nwosu has applied for a $2,000 emergency loan. Review required.', timestamp: '2026-06-30T18:44:00Z', read: false, actionLabel: 'Review', actionHref: '/dashboard/loans' },
  { id: 'notif-004', type: 'loan', title: 'New loan application', description: 'Amina Kofi has applied for a $4,000 salon equipment loan.', timestamp: '2026-06-28T14:22:00Z', read: false, actionLabel: 'Review', actionHref: '/dashboard/loans' },
  { id: 'notif-005', type: 'vote', title: 'Vote needed', description: 'Proposal: Increase Loan Ceiling — closes in 5 days. Your vote is pending.', timestamp: '2026-06-28T10:00:00Z', read: false, actionLabel: 'Vote Now', actionHref: '/dashboard/governance' },
  { id: 'notif-006', type: 'warning', title: 'Missed contribution alert', description: 'Amara Nwosu has now missed 2 consecutive contributions.', timestamp: '2026-06-27T09:00:00Z', read: true },
  { id: 'notif-007', type: 'member', title: 'New member joined', description: 'Chidi Obi has completed onboarding and joined the cooperative.', timestamp: '2026-06-25T11:30:00Z', read: true },
  { id: 'notif-008', type: 'proposal', title: 'Proposal passed', description: 'Proposal: Admit 5 New Members (Batch 3) passed with 86% approval.', timestamp: '2026-06-15T16:00:00Z', read: true },
  { id: 'notif-009', type: 'contribution', title: 'Contribution received', description: 'Kwame Asante contributed $350 — July 2026', timestamp: '2026-07-01T08:35:00Z', read: true },
  { id: 'notif-010', type: 'treasury', title: 'Treasury milestone reached', description: 'Total treasury has exceeded $45,000 for the first time.', timestamp: '2026-06-30T23:59:00Z', read: true },
];

// ── Nexa AI Initial Messages ───────────────────────────────────────────────────

export const INITIAL_AI_MESSAGES: AIMessage[] = [
  {
    id: 'ai-001',
    role: 'nexa',
    content:
      `Hello! I'm **Nexa**, your AI-powered cooperative assistant. 👋\n\n` +
      `I can help you:\n` +
      `- Analyse treasury health and cash flow\n` +
      `- Review loan applications and risk\n` +
      `- Track member contributions and compliance\n` +
      `- Draft governance proposals and insights\n` +
      `- Generate monthly reports\n\n` +
      `Try asking me: *"How healthy is our treasury?"* or *"Should we approve Amina's loan?"*`,
    timestamp: new Date().toISOString(),
  },
];

// ── Chart data ─────────────────────────────────────────────────────────────────

export const MEMBER_GROWTH_DATA = [
  { label: 'Aug', value: 12 },
  { label: 'Sep', value: 14 },
  { label: 'Oct', value: 16 },
  { label: 'Nov', value: 18 },
  { label: 'Dec', value: 19 },
  { label: 'Jan', value: 20 },
  { label: 'Feb', value: 21 },
  { label: 'Mar', value: 22 },
  { label: 'Apr', value: 23 },
  { label: 'May', value: 24 },
  { label: 'Jun', value: 25 },
  { label: 'Jul', value: 25 },
];

export const REPAYMENT_RATE_DATA = [
  { label: 'Feb', value: 88 },
  { label: 'Mar', value: 90 },
  { label: 'Apr', value: 91.5 },
  { label: 'May', value: 92.1 },
  { label: 'Jun', value: 94.2 },
  { label: 'Jul', value: 94.2 },
];

export const RISK_DISTRIBUTION = [
  { name: 'Low Risk (0–30)', value: 14, color: '#10b981' },
  { name: 'Medium Risk (31–60)', value: 8, color: '#f59e0b' },
  { name: 'High Risk (61–100)', value: 3, color: '#ef4444' },
];

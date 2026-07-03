/**
 * Nexa AI service — abstraction layer for AI-powered cooperative intelligence.
 *
 * Architecture:
 * - Service functions are pure (no side effects) and easily swappable.
 * - Each function can be backed by any LLM (OpenAI, Anthropic, local models).
 * - For now, responses are generated from demo data with pre-scripted intelligence.
 */

import type { AIMessage, AIInsight } from '@/types';

// ── Response engine ────────────────────────────────────────────────────────────

const TREASURY_BALANCE = 45_280;
const MEMBERS = 23;
const REPAYMENT_RATE = 94.2;
const LOANS_OUTSTANDING = 18_500;
const MONTHLY_INFLOW = 8_750;

type ResponseEntry = { pattern: RegExp; response: string };

const RESPONSE_TABLE: ResponseEntry[] = [
  {
    pattern: /health|healthy|status|how.*(we|cooperative)/i,
    response:
      `**Your cooperative is in excellent health.** 🟢\n\n` +
      `Here's a quick snapshot:\n` +
      `- **Treasury**: $${TREASURY_BALANCE.toLocaleString()} — 8.3% up from last month\n` +
      `- **Repayment rate**: ${REPAYMENT_RATE}% — above the 90% threshold\n` +
      `- **Active members**: ${MEMBERS}/25 contributing regularly\n` +
      `- **AI Health Score**: 92/100\n\n` +
      `**Recommendations**: Continue your current contribution schedule. Consider expanding the loan pool by $5,000 to meet growing demand.`,
  },
  {
    pattern: /treasury|balance|fund|money/i,
    response:
      `**Treasury Overview**\n\n` +
      `| Category | Amount |\n|---|---|\n` +
      `| Available Balance | $28,500 |\n` +
      `| Loan Pool | $12,000 |\n` +
      `| Emergency Reserve | $4,780 |\n\n` +
      `Your cash flow is positive at **+$6,200 net** this month. Monthly inflow ($${MONTHLY_INFLOW.toLocaleString()}) comfortably exceeds outflow ($2,550).\n\n` +
      `**Insight**: At the current growth rate, the treasury will reach $60,000 by Q3 2026.`,
  },
  {
    pattern: /miss.*contribution|late|default|behind/i,
    response:
      `**Contribution Compliance Report**\n\n` +
      `2 members have missed their last contribution:\n` +
      `- **David Okafor** — 1 missed (last contribution: 45 days ago)\n` +
      `- **Amara Nwosu** — 2 missed (flagged for review)\n\n` +
      `**Action recommended**: Send automated reminders to both members. If Amara misses another contribution, recommend a compliance review per your governance policy.`,
  },
  {
    pattern: /loan.*john|approve.*john|john.*loan/i,
    response:
      `**Loan Assessment: John Mensah**\n\n` +
      `- **Amount requested**: $2,500\n` +
      `- **Purpose**: Business expansion (mobile food vendor)\n` +
      `- **Risk Score**: 28/100 (🟢 Low)\n` +
      `- **Repayment forecast**: 96.4% likelihood of on-time repayment\n` +
      `- **Contribution history**: 18/18 months — perfect record\n\n` +
      `**Nexa recommends APPROVAL** ✅\n\nJohn is one of your most reliable members. Approve at the standard 2% monthly rate over 12 months ($231/month).`,
  },
  {
    pattern: /loan|borrow|credit/i,
    response:
      `**Loan Portfolio Summary**\n\n` +
      `- **Active loans**: 4 ($${LOANS_OUTSTANDING.toLocaleString()} outstanding)\n` +
      `- **Average risk score**: 35/100 (Low)\n` +
      `- **Repayment rate**: ${REPAYMENT_RATE}%\n` +
      `- **Pending review**: 2 applications\n\n` +
      `**Insight**: Your loan portfolio is well-managed. Consider increasing the loan ceiling from $3,000 to $4,000 for members with a contribution score above 85.`,
  },
  {
    pattern: /improv|suggest|recommend|better|optimis/i,
    response:
      `**Improvement Recommendations for This Month**\n\n` +
      `1. **📊 Increase contribution visibility** — 4 members haven't viewed the treasury report in 30+ days. Share a monthly summary automatically.\n\n` +
      `2. **💡 Launch an emergency fund pool** — Your emergency reserve ($4,780) is below the recommended 15% of treasury. Target: $6,800.\n\n` +
      `3. **🗳 Schedule the Q3 governance vote** — 2 pending proposals need scheduling before July 31.\n\n` +
      `4. **🤖 Enable auto-reminders** — Automated contribution reminders could reduce missed payments by ~40%.`,
  },
  {
    pattern: /member|who|person/i,
    response:
      `**Member Intelligence**\n\n` +
      `Your cooperative has **25 registered members**, ${MEMBERS} currently active.\n\n` +
      `**Top performers** (by contribution score):\n` +
      `1. Grace Mensah — 98/100\n2. Kwame Asante — 96/100\n3. Fatima Diallo — 94/100\n\n` +
      `**At-risk members** (need attention):\n` +
      `- David Okafor — 62/100 (1 missed payment)\n` +
      `- Amara Nwosu — 44/100 (2 missed payments)\n\n` +
      `Would you like me to generate personalised outreach messages for at-risk members?`,
  },
  {
    pattern: /governance|vote|proposal/i,
    response:
      `**Governance Update**\n\n` +
      `- **Active proposals**: 2\n` +
      `- **Governance score**: 87/100\n` +
      `- **Member participation rate**: 78% (last vote)\n\n` +
      `**Active proposals needing your attention**:\n` +
      `1. *Increase Loan Ceiling to $4,000* — Voting closes in 5 days (67% approval so far)\n` +
      `2. *Add Emergency Fund Policy* — Voting closes in 12 days\n\n` +
      `**Nexa insight**: Both proposals are likely to pass. Proposal #1 will increase loan accessibility for 8 eligible members.`,
  },
  {
    pattern: /fraud|suspicious|alert|risk/i,
    response:
      `**Fraud & Risk Monitoring** 🛡\n\n` +
      `No active fraud alerts. Your cooperative risk level is **LOW**.\n\n` +
      `**Monitoring status**:\n` +
      `- Contribution anomalies: None detected\n` +
      `- Loan repayment risk: 1 member flagged (low severity)\n` +
      `- Wallet activity: All verified identities active\n\n` +
      `**AI monitoring runs every 24 hours.** Last scan: 2 hours ago.`,
  },
  {
    pattern: /report|summary|month/i,
    response:
      `**Monthly Report — June 2026**\n\n` +
      `| Metric | Value | vs Last Month |\n|---|---|---|\n` +
      `| Treasury | $45,280 | ↑ 8.3% |\n` +
      `| Contributions | $8,750 | ↑ 12.1% |\n` +
      `| Active Members | 23 | ↑ 2 |\n` +
      `| Loans Issued | 1 ($2,500) | — |\n` +
      `| Repayment Rate | 94.2% | ↑ 2.1% |\n\n` +
      `**Overall assessment**: Excellent month. Your cooperative is in strong financial health and growing steadily.`,
  },
];

const FALLBACK_RESPONSES = [
  `I'm analysing your cooperative data... Based on current metrics, everything looks healthy. Could you be more specific? For example, ask me about **treasury health**, **loan recommendations**, **member compliance**, or **improvement suggestions**.`,
  `Great question! Let me pull up the relevant data. Could you clarify what you'd like to know? I can help with **treasury insights**, **member analysis**, **loan decisions**, **governance**, or **monthly reports**.`,
  `I'm here to help your cooperative thrive. Try asking me:\n- "How healthy is our treasury?"\n- "Who has missed contributions?"\n- "Should we approve John's loan?"\n- "What should we improve this month?"`,
];

let fallbackIndex = 0;

export function getNexaResponse(query: string): string {
  for (const entry of RESPONSE_TABLE) {
    if (entry.pattern.test(query)) {
      return entry.response;
    }
  }
  const response = FALLBACK_RESPONSES[fallbackIndex % FALLBACK_RESPONSES.length];
  fallbackIndex++;
  return response;
}

// ── AI Insights ────────────────────────────────────────────────────────────────

export const AI_INSIGHTS: AIInsight[] = [
  {
    id: '1',
    category: 'Treasury',
    title: 'Treasury on track for $60K by Q3',
    body: 'At the current growth rate of 8.3% monthly, your treasury will reach $60,000 by Q3 2026.',
    severity: 'success',
    timestamp: '2026-07-01T08:00:00Z',
  },
  {
    id: '2',
    category: 'Members',
    title: '2 members need contribution follow-up',
    body: 'David Okafor and Amara Nwosu have missed recent contributions. Automated reminders are recommended.',
    severity: 'warning',
    timestamp: '2026-07-01T07:30:00Z',
  },
  {
    id: '3',
    category: 'Loans',
    title: 'Loan pool utilisation is 67%',
    body: 'The loan pool is $12,000. Current utilisation: 67%. Consider increasing pool by $3,000 to meet demand.',
    severity: 'info',
    timestamp: '2026-06-30T18:00:00Z',
  },
  {
    id: '4',
    category: 'Governance',
    title: 'Proposal: Increase loan ceiling — likely to pass',
    body: '67% approval rate with 5 days remaining. Expected outcome: PASS. Prepare implementation plan.',
    severity: 'info',
    timestamp: '2026-06-30T12:00:00Z',
  },
  {
    id: '5',
    category: 'Risk',
    title: 'No fraud alerts detected',
    body: 'All member wallet activities verified. Contribution patterns are normal. Risk level: LOW.',
    severity: 'success',
    timestamp: '2026-07-01T06:00:00Z',
  },
];

// ── Agent stubs ────────────────────────────────────────────────────────────────
// These are architecture stubs for future autonomous agent integration.

export const TreasuryAgent = {
  name: 'Treasury Agent',
  description: 'Monitors cash flow, reserves, and financial health.',
  run: async () => ({ status: 'healthy', balance: TREASURY_BALANCE }),
};

export const ContributionAgent = {
  name: 'Contribution Agent',
  description: 'Tracks and enforces contribution schedules.',
  run: async () => ({ pending: 2, onTime: 21, late: 2 }),
};

export const LoanAgent = {
  name: 'Loan Agent',
  description: 'Evaluates loan applications and monitors repayments.',
  run: async () => ({ active: 4, repaymentRate: REPAYMENT_RATE }),
};

export const GovernanceAgent = {
  name: 'Governance Agent',
  description: 'Manages proposals, voting, and policy enforcement.',
  run: async () => ({ proposals: 2, participationRate: 78 }),
};

export const FraudDetectionAgent = {
  name: 'Fraud Detection Agent',
  description: 'Detects anomalies in contributions and transactions.',
  run: async () => ({ alerts: 0, riskLevel: 'LOW' }),
};

export const NotificationAgent = {
  name: 'Notification Agent',
  description: 'Sends automated alerts and reminders to members.',
  run: async () => ({ sent: 0, pending: 2 }),
};

export const ReportingAgent = {
  name: 'Reporting Agent',
  description: 'Generates monthly summaries and analytics reports.',
  run: async () => ({ lastReport: '2026-06-01', nextReport: '2026-07-01' }),
};

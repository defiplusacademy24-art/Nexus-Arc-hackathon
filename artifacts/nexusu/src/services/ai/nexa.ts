/**
 * Nexa AI service — advisory responses from live cooperative context only.
 * No fictional balances, members, or repayment rates.
 * Future: plug into AI treasury / lending / governance agents.
 */

import type { AIInsight, Cooperative, Member } from '@/types';
import { formatCurrency } from '@/utils/format';

export type NexaContext = {
  cooperative?: Cooperative | null;
  members?: Member[];
  treasuryBalance?: number;
  monthlyInflow?: number;
  monthlyOutflow?: number;
  loanCount?: number;
  loansOutstanding?: number;
  proposalCount?: number;
  activeProposalCount?: number;
};

function fmt(n: number, currency = 'USD'): string {
  try {
    return formatCurrency(n, currency);
  } catch {
    return `$${n.toLocaleString()}`;
  }
}

export function getNexaResponse(query: string, ctx: NexaContext = {}): string {
  const coop = ctx.cooperative;
  const name = coop?.name ?? 'your cooperative';
  const currency = coop?.currency ?? 'USD';
  const treasury = ctx.treasuryBalance ?? coop?.treasuryBalance ?? 0;
  const members = ctx.members ?? [];
  const memberCount = members.length || coop?.memberCount || 0;
  const activeMembers = members.filter((m) => m.status === 'active').length || memberCount;
  const inflow = ctx.monthlyInflow ?? 0;
  const outflow = ctx.monthlyOutflow ?? 0;
  const loans = ctx.loanCount ?? 0;
  const loansOut = ctx.loansOutstanding ?? 0;
  const proposals = ctx.proposalCount ?? 0;
  const activeProposals = ctx.activeProposalCount ?? 0;
  const missed = members.filter((m) => (m.missedContributions ?? 0) > 0);
  const q = query.trim();

  if (/health|healthy|status|how.*(we|cooperative)/i.test(q)) {
    if (!coop) {
      return (
        `**No cooperative selected.**\n\n` +
        `Create or join a cooperative first. Once you have live members and treasury activity, I can report real health metrics.`
      );
    }
    return (
      `**Live status for ${name}**\n\n` +
      `- **Treasury**: ${fmt(treasury, currency)}\n` +
      `- **Members**: ${activeMembers}${coop.maxMembers ? ` / ${coop.maxMembers}` : ''}\n` +
      `- **Status**: ${coop.status}\n` +
      `- **Contribution / cycle**: ${fmt(coop.contributionAmount, currency)} (${coop.contributionFrequency})\n` +
      `- **This month inflow**: ${fmt(inflow, currency)}\n` +
      `- **This month outflow**: ${fmt(outflow, currency)}\n\n` +
      (treasury <= 0
        ? `Treasury is empty — record deposits or contributions from the Treasury page to start on-chain / off-chain settlement tracking.`
        : `Balances above come from your cooperative ledger (and wallet activity when connected).`)
    );
  }

  if (/treasury|balance|fund|money/i.test(q)) {
    return (
      `**Treasury (live)**\n\n` +
      `| Category | Amount |\n|---|---|\n` +
      `| Total balance | ${fmt(treasury, currency)} |\n` +
      `| Monthly inflow | ${fmt(inflow, currency)} |\n` +
      `| Monthly outflow | ${fmt(outflow, currency)} |\n` +
      `| Net flow | ${fmt(inflow - outflow, currency)} |\n\n` +
      `These figures are derived from recorded cooperative transactions — not demo data.`
    );
  }

  if (/miss.*contribution|late|default|behind/i.test(q)) {
    if (missed.length === 0) {
      return (
        `**Contribution compliance**\n\n` +
        `No members currently marked with missed contributions in the live roster (${activeMembers} members tracked).`
      );
    }
    const lines = missed
      .slice(0, 10)
      .map((m) => `- **${m.name}** — ${m.missedContributions} missed`)
      .join('\n');
    return `**Contribution compliance**\n\n${lines}`;
  }

  if (/loan|borrow|credit/i.test(q)) {
    return (
      `**Loan portfolio (live)**\n\n` +
      `- **Loan records**: ${loans}\n` +
      `- **Outstanding**: ${fmt(loansOut, currency)}\n\n` +
      (loans === 0
        ? `No loan applications yet. When lending is enabled on Arc, applications and AI credit checks will appear here.`
        : `Figures reflect stored loan records only.`)
    );
  }

  if (/improv|suggest|recommend|better|optimis/i.test(q)) {
    const tips: string[] = [];
    if (!coop) tips.push('Create or join a cooperative to unlock treasury and member tooling.');
    if (memberCount <= 1) tips.push('Invite members so join-order payout positions fill out.');
    if (treasury <= 0) tips.push('Record the first treasury deposit or contribution.');
    if (inflow === 0) tips.push('Log cycle contributions to build a real cash-flow history.');
    if (tips.length === 0) {
      tips.push('Keep contribution schedules current and review the Members page payout order.');
    }
    return (
      `**Recommendations based on live data**\n\n` +
      tips.map((t, i) => `${i + 1}. ${t}`).join('\n\n')
    );
  }

  if (/govern|vote|proposal/i.test(q)) {
    return (
      `**Governance (live)**\n\n` +
      `- **Proposals on record**: ${proposals}\n` +
      `- **Active**: ${activeProposals}\n` +
      `- **Score**: ${coop?.governanceScore ?? 0}/100\n\n` +
      (proposals === 0
        ? `No proposals yet. Create one from Governance when your group is ready to vote on-chain or off-chain.`
        : `Proposal counts come from stored governance records.`)
    );
  }

  if (/fraud|suspicious|alert|risk/i.test(q)) {
    return (
      `**Risk monitoring**\n\n` +
      `No automated fraud alerts are stored yet. Risk agents will surface on-chain anomalies here once connected.\n\n` +
      `- Flagged members (missed contributions): ${missed.length}\n` +
      `- Live members: ${activeMembers}`
    );
  }

  if (/report|summary|month/i.test(q)) {
    return (
      `**Live summary**\n\n` +
      `| Metric | Value |\n|---|---|\n` +
      `| Cooperative | ${name} |\n` +
      `| Treasury | ${fmt(treasury, currency)} |\n` +
      `| Members | ${activeMembers} |\n` +
      `| Inflow (month) | ${fmt(inflow, currency)} |\n` +
      `| Outflow (month) | ${fmt(outflow, currency)} |\n` +
      `| Loans outstanding | ${fmt(loansOut, currency)} |\n\n` +
      `Generated from current cooperative state — zeros mean no real activity recorded yet.`
    );
  }

  return (
    `I only answer from **live cooperative data** (no mock figures).\n\n` +
    `Try:\n` +
    `- "How healthy is our treasury?"\n` +
    `- "Who has missed contributions?"\n` +
    `- "Loan portfolio summary"\n` +
    `- "Monthly report"\n\n` +
    `Current treasury: **${fmt(treasury, currency)}** · Members: **${activeMembers}**`
  );
}

/** Insights from live context only — empty when there is nothing real to report. */
export function buildLiveInsights(ctx: NexaContext = {}): AIInsight[] {
  const coop = ctx.cooperative;
  if (!coop) return [];

  const currency = coop.currency ?? 'USD';
  const treasury = ctx.treasuryBalance ?? coop.treasuryBalance ?? 0;
  const members = ctx.members ?? [];
  const memberCount = members.length || coop.memberCount || 0;
  const inflow = ctx.monthlyInflow ?? 0;
  const now = new Date().toISOString();
  const insights: AIInsight[] = [];

  insights.push({
    id: 'live-treasury',
    category: 'Treasury',
    title: treasury > 0 ? 'Treasury balance recorded' : 'Treasury empty',
    body:
      treasury > 0
        ? `${fmt(treasury, currency)} on hand${inflow > 0 ? ` · ${fmt(inflow, currency)} inflow this month` : ''}.`
        : 'No deposits or contributions recorded yet. Use Treasury to post the first real transaction.',
    severity: treasury > 0 ? 'success' : 'warning',
    timestamp: now,
  });

  insights.push({
    id: 'live-members',
    category: 'Members',
    title: `${memberCount} member${memberCount === 1 ? '' : 's'} on roster`,
    body:
      memberCount <= 1
        ? 'Invite others with your invite code to assign permanent payout positions.'
        : `Live roster size is ${memberCount}. Join-order positions are permanent once assigned.`,
    severity: memberCount > 1 ? 'success' : 'info',
    timestamp: now,
  });

  const loans = ctx.loanCount ?? 0;
  insights.push({
    id: 'live-loans',
    category: 'Loans',
    title: loans === 0 ? 'No loans on record' : `${loans} loan record(s)`,
    body:
      loans === 0
        ? 'Lending UI is ready; applications will appear when members request loans.'
        : `Outstanding: ${fmt(ctx.loansOutstanding ?? 0, currency)}.`,
    severity: 'info',
    timestamp: now,
  });

  return insights.slice(0, 5);
}

/** @deprecated Prefer buildLiveInsights(ctx) */
export const AI_INSIGHTS: AIInsight[] = [];

export const TreasuryAgent = {
  name: 'Treasury Agent',
  description: 'Monitors cash flow, reserves, and financial health.',
  run: async (ctx: NexaContext = {}) => ({
    status: (ctx.treasuryBalance ?? 0) > 0 ? 'active' : 'empty',
    balance: ctx.treasuryBalance ?? ctx.cooperative?.treasuryBalance ?? 0,
  }),
};

export const ContributionAgent = {
  name: 'Contribution Agent',
  description: 'Tracks and enforces contribution schedules.',
  run: async (ctx: NexaContext = {}) => {
    const members = ctx.members ?? [];
    return {
      pending: members.filter((m) => m.contributionStatus === 'pending').length,
      onTime: members.filter((m) => m.contributionStatus === 'paid').length,
      late: members.filter((m) => (m.missedContributions ?? 0) > 0).length,
    };
  },
};

export const LoanAgent = {
  name: 'Loan Agent',
  description: 'Evaluates loan applications and monitors repayments.',
  run: async (ctx: NexaContext = {}) => ({
    active: ctx.loanCount ?? 0,
    repaymentRate: 0,
  }),
};

export const GovernanceAgent = {
  name: 'Governance Agent',
  description: 'Manages proposals, voting, and policy enforcement.',
  run: async (ctx: NexaContext = {}) => ({
    proposals: ctx.proposalCount ?? 0,
    participationRate: 0,
  }),
};

export const FraudDetectionAgent = {
  name: 'Fraud Detection Agent',
  description: 'Detects anomalies in contributions and transactions.',
  run: async () => ({ alerts: 0, riskLevel: 'UNKNOWN' as const }),
};

export const NotificationAgent = {
  name: 'Notification Agent',
  description: 'Sends automated alerts and reminders to members.',
  run: async () => ({ sent: 0, pending: 0 }),
};

export const ReportingAgent = {
  name: 'Reporting Agent',
  description: 'Generates monthly summaries and analytics reports.',
  run: async () => ({ lastReport: null, nextReport: null }),
};

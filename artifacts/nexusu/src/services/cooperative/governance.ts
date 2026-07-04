/**
 * Governance configuration per cooperative.
 * Future-ready: plug into on-chain governance proposals via Unicity.
 */

import type { VotingModel, LoanApprovalPolicy } from '@/types';

export interface GovernanceConfig {
  votingModel: VotingModel;
  approvalThreshold: number;      // 50–100 %
  loanApprovalPolicy: LoanApprovalPolicy;
  aiGovernanceEnabled: boolean;
}

const key = (coopId: string) => `nexusu:governance:${coopId}`;

const DEFAULTS: GovernanceConfig = {
  votingModel: 'simple-majority',
  approvalThreshold: 51,
  loanApprovalPolicy: 'hybrid',
  aiGovernanceEnabled: true,
};

export function getGovernanceConfig(cooperativeId: string): GovernanceConfig {
  try {
    const raw = localStorage.getItem(key(cooperativeId));
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function saveGovernanceConfig(
  cooperativeId: string,
  config: GovernanceConfig,
): void {
  localStorage.setItem(key(cooperativeId), JSON.stringify(config));
}

export const VOTING_MODEL_LABELS: Record<VotingModel, string> = {
  'simple-majority': 'Simple Majority (>50%)',
  supermajority: 'Supermajority (≥66%)',
  unanimous: 'Unanimous (100%)',
};

export const LOAN_POLICY_LABELS: Record<LoanApprovalPolicy, string> = {
  'admin-only': 'Admin Decision',
  'member-vote': 'Member Vote',
  'ai-recommended': 'AI Recommendation',
  hybrid: 'Hybrid (AI + Vote)',
};

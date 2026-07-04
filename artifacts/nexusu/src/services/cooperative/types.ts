/**
 * Cooperative service layer types.
 * Shared between services/cooperative/* — keep UI-agnostic.
 */

import type {
  CoopType, CoopPrivacy, VotingModel, LoanApprovalPolicy, ContributionFrequency,
} from '@/types';

export interface CoopCreateInput {
  // Step 1 — Basic Info
  name: string;
  description: string;
  country: string;
  currency: string;
  type: CoopType;
  // Step 2 — Rules
  contributionFrequency: ContributionFrequency;
  contributionAmount: number;
  maxMembers?: number;
  privacy: CoopPrivacy;
  // Step 3 — Governance
  votingModel: VotingModel;
  approvalThreshold: number;   // 50–100 (%)
  loanApprovalPolicy: LoanApprovalPolicy;
  aiGovernanceEnabled: boolean;
  // Step 4 — Pre-generated identity (optional; service generates if omitted)
  inviteCode?: string;
  cooperativeId?: string;
}

export interface Invitation {
  id: string;
  cooperativeId: string;
  code: string;
  inviteLink: string;
  createdAt: string;
  expiresAt?: string;
}

export interface JoinResult {
  ok: boolean;
  coop?: import('@/types').Cooperative;
  error?: string;
}

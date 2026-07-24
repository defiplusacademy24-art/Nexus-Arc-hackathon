/**
 * Cooperative service layer types.
 * Shared between services/cooperative/* — keep UI-agnostic.
 */

import type {
  CoopType,
  CoopPrivacy,
  VotingModel,
  LoanApprovalPolicy,
  ContributionFrequency,
  RotationMode,
  Member,
  Cooperative,
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
  /** Payout strategy — default JOIN_ORDER. Only JOIN_ORDER is implemented for MVP. */
  rotationMode?: RotationMode;
  // Step 3 — Governance
  votingModel: VotingModel;
  approvalThreshold: number;   // 50–100 (%)
  loanApprovalPolicy: LoanApprovalPolicy;
  aiGovernanceEnabled: boolean;
  // Step 4 — Pre-generated identity (optional; service generates if omitted)
  inviteCode?: string;
  cooperativeId?: string;
  /**
   * Initial lifecycle status after launch.
   * Defaults to `open` so members can join immediately.
   */
  status?: Cooperative['status'];
}

export interface Invitation {
  id: string;
  cooperativeId: string;
  code: string;
  inviteLink: string;
  createdAt: string;
  expiresAt?: string;
}

export interface MemberRegistrationInput {
  walletAddress: string;
  email: string;
  displayName: string;
}

export interface JoinResult {
  ok: boolean;
  coop?: Cooperative;
  member?: Member;
  /** Assigned permanent payout position (1-based). */
  joinPosition?: number;
  error?: string;
}

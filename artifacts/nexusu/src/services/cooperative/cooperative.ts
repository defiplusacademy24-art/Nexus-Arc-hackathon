/**
 * Cooperative CRUD — localStorage-backed.
 * Future-ready: replace storage calls with Unicity on-chain treasury calls.
 */

import type { Cooperative } from '@/types';
import type { CoopCreateInput } from './types';
import { generateCoopId, generateInviteCode } from './invitations';

const STORAGE_KEY = 'nexusu:cooperatives';

export function loadCooperatives(): Cooperative[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Cooperative[]) : [];
  } catch {
    return [];
  }
}

export function saveCooperatives(coops: Cooperative[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(coops));
}

export function createCooperative(
  input: CoopCreateInput,
  walletIdentity: string,
): Cooperative {
  const coops = loadCooperatives();
  const id = `coop-${Date.now()}`;
  const cooperative: Cooperative = {
    id,
    name: input.name,
    description: input.description,
    type: input.type,
    country: input.country,
    currency: input.currency,
    memberCount: 1,
    treasuryBalance: 0,
    contributionAmount: input.contributionAmount,
    contributionFrequency: input.contributionFrequency,
    walletIdentity,
    status: 'active',
    governanceScore: 100,
    aiHealthScore: 100,
    createdAt: new Date().toISOString().split('T')[0],
    privacy: input.privacy,
    votingModel: input.votingModel,
    approvalThreshold: input.approvalThreshold,
    loanApprovalPolicy: input.loanApprovalPolicy,
    aiGovernanceEnabled: input.aiGovernanceEnabled,
    maxMembers: input.maxMembers,
    inviteCode: input.inviteCode ?? generateInviteCode(),
    cooperativeId: input.cooperativeId ?? generateCoopId(),
    founderWalletIdentity: walletIdentity,
  };
  saveCooperatives([...coops, cooperative]);
  return cooperative;
}

export function getCooperative(id: string): Cooperative | null {
  return loadCooperatives().find((c) => c.id === id) ?? null;
}

export function updateCooperative(
  id: string,
  updates: Partial<Cooperative>,
): Cooperative {
  const coops = loadCooperatives();
  const idx = coops.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error(`Cooperative ${id} not found`);
  const updated = { ...coops[idx], ...updates };
  coops[idx] = updated;
  saveCooperatives(coops);
  return updated;
}

export function deleteCooperative(id: string): void {
  saveCooperatives(loadCooperatives().filter((c) => c.id !== id));
}

export function findByInviteCode(code: string): Cooperative | null {
  const normalised = code.trim().toUpperCase();
  return loadCooperatives().find((c) => c.inviteCode === normalised) ?? null;
}

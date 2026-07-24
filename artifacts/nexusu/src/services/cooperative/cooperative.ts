/**
 * Cooperative CRUD — localStorage-backed.
 * Future-ready: replace storage calls with Arc treasury / Circle wallet integrations.
 */

import type { Cooperative, RotationMode } from '@/types';
import { DEFAULT_ROTATION_MODE } from '@/types';
import type { CoopCreateInput } from './types';
import { generateCoopId, generateInviteCode } from './invitations';
import { normaliseRotationMode, isRotationModeImplemented } from './rotation';

const STORAGE_KEY = 'nexusu:cooperatives';

export function loadCooperatives(): Cooperative[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Cooperative[];
    return list.map(normaliseCooperative);
  } catch {
    return [];
  }
}

export function saveCooperatives(coops: Cooperative[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(coops));
}

function normaliseCooperative(c: Cooperative): Cooperative {
  return {
    ...c,
    rotationMode: normaliseRotationMode(c.rotationMode),
    currentRecipientPosition: c.currentRecipientPosition ?? 1,
    currentCycle: c.currentCycle ?? 1,
    status: c.status ?? 'open',
  };
}

export function createCooperative(
  input: CoopCreateInput,
  walletIdentity: string,
): Cooperative {
  const coops = loadCooperatives();
  const id = `coop-${Date.now()}`;

  let rotationMode: RotationMode = normaliseRotationMode(
    input.rotationMode ?? DEFAULT_ROTATION_MODE,
  );
  // MVP: only JOIN_ORDER is live — coerce unimplemented selections to default
  // but still store the selected mode if UI marked it as "coming soon" and user
  // somehow forced it. Prefer implemented mode for create.
  if (!isRotationModeImplemented(rotationMode)) {
    rotationMode = DEFAULT_ROTATION_MODE;
  }

  // Launch → open (members may join). Draft only while still configuring.
  const status = input.status ?? 'open';

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
    status,
    governanceScore: 0,
    aiHealthScore: 0,
    createdAt: new Date().toISOString().split('T')[0],
    privacy: input.privacy,
    votingModel: input.votingModel,
    approvalThreshold: input.approvalThreshold,
    loanApprovalPolicy: input.loanApprovalPolicy,
    aiGovernanceEnabled: input.aiGovernanceEnabled,
    maxMembers: input.maxMembers,
    rotationMode,
    currentRecipientPosition: 1,
    currentCycle: 1,
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
  const updated = normaliseCooperative({ ...coops[idx], ...updates });
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

/**
 * Activate cooperative: close joining permanently and lock payout order.
 * Triggered when max members is reached or owner starts the cooperative.
 */
export function activateCooperative(id: string): Cooperative {
  const coop = getCooperative(id);
  if (!coop) throw new Error(`Cooperative ${id} not found`);
  if (coop.status === 'active' || coop.status === 'completed') {
    return coop;
  }
  return updateCooperative(id, {
    status: 'active',
    currentRecipientPosition: coop.currentRecipientPosition ?? 1,
    currentCycle: coop.currentCycle ?? 1,
  });
}

/**
 * If member count has hit maxMembers while still open, auto-activate.
 * Returns the (possibly updated) cooperative.
 */
export function maybeAutoActivate(id: string): Cooperative | null {
  const coop = getCooperative(id);
  if (!coop) return null;
  if (coop.status !== 'open' && coop.status !== 'draft' && coop.status !== 'pending') {
    return coop;
  }
  if (
    typeof coop.maxMembers === 'number' &&
    coop.maxMembers > 0 &&
    coop.memberCount >= coop.maxMembers
  ) {
    return activateCooperative(id);
  }
  return coop;
}

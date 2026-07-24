/**
 * Payout rotation strategies.
 *
 * Architecture is strategy-based so RANDOM, ORGANIZER_ASSIGNED, and
 * GOVERNANCE_VOTE can be plugged in later without changing the data model.
 * MVP implements JOIN_ORDER only.
 */

import type { Cooperative, Member, RotationMode } from '@/types';
import { DEFAULT_ROTATION_MODE } from '@/types';

export const ROTATION_MODE_LABELS: Record<RotationMode, string> = {
  JOIN_ORDER: 'Join Order',
  RANDOM: 'Random Draw',
  ORGANIZER_ASSIGNED: 'Organizer Assigned',
  GOVERNANCE_VOTE: 'Governance Vote',
};

export const ROTATION_MODE_DESCRIPTIONS: Record<RotationMode, string> = {
  JOIN_ORDER:
    'Members receive the pooled contribution based on the order they joined. Recommended for traditional Esusu, Ajo, Chama and Stokvel groups.',
  RANDOM:
    'The system randomly selects the next payout recipient each contribution cycle. Coming soon.',
  ORGANIZER_ASSIGNED:
    'The cooperative organizer manually assigns payout positions before the cooperative starts. Coming soon.',
  GOVERNANCE_VOTE:
    'Members vote to determine who receives the next payout. Coming soon.',
};

/** Modes available for selection at create-time. Others are UI-only placeholders. */
export const IMPLEMENTED_ROTATION_MODES: RotationMode[] = ['JOIN_ORDER'];

export function isRotationModeImplemented(mode: RotationMode): boolean {
  return IMPLEMENTED_ROTATION_MODES.includes(mode);
}

export function normaliseRotationMode(mode?: string | null): RotationMode {
  if (
    mode === 'JOIN_ORDER' ||
    mode === 'RANDOM' ||
    mode === 'ORGANIZER_ASSIGNED' ||
    mode === 'GOVERNANCE_VOTE'
  ) {
    return mode;
  }
  return DEFAULT_ROTATION_MODE;
}

export interface PayoutOrderEntry {
  position: number;
  member: Member;
}

/**
 * Sort members into permanent payout order by joinPosition.
 * Falls back to joinedAt ascending when joinPosition is missing (legacy data).
 * Never reorders positions that are already assigned.
 */
export function getPayoutOrder(members: Member[]): PayoutOrderEntry[] {
  const sorted = [...members].sort((a, b) => {
    const pa = a.joinPosition ?? Number.MAX_SAFE_INTEGER;
    const pb = b.joinPosition ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
  });

  return sorted.map((member, index) => ({
    position: member.joinPosition ?? index + 1,
    member,
  }));
}

/**
 * Next join position for a new member: currentMembers + 1.
 */
export function nextJoinPosition(currentMemberCount: number): number {
  return Math.max(0, currentMemberCount) + 1;
}

/**
 * Assign sequential join positions to members missing them (migration helper).
 * Existing positions are preserved; gaps are not refilled.
 */
export function ensureJoinPositions(members: Member[]): Member[] {
  const withPositions = members.filter(
    (m) => typeof m.joinPosition === 'number' && m.joinPosition > 0,
  );
  const without = members
    .filter((m) => !(typeof m.joinPosition === 'number' && m.joinPosition > 0))
    .sort(
      (a, b) =>
        new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime(),
    );

  let next =
    withPositions.reduce((max, m) => Math.max(max, m.joinPosition ?? 0), 0) + 1;

  const assigned = new Map<string, Member>();
  for (const m of withPositions) assigned.set(m.id, m);
  for (const m of without) {
    assigned.set(m.id, { ...m, joinPosition: next });
    next += 1;
  }

  return members.map((m) => assigned.get(m.id) ?? m);
}

export interface CooperativeSummary {
  memberCount: number;
  maxMembers: number | null;
  currentRecipientPosition: number;
  nextRecipientPosition: number | null;
  contributionAmount: number;
  contributionFrequency: string;
  status: string;
  rotationMode: RotationMode;
  rotationModeLabel: string;
  currentCycle: number;
  joiningClosed: boolean;
}

/**
 * Build cooperative summary for Members / Cooperatives dashboard panels.
 */
export function buildCooperativeSummary(
  coop: Cooperative,
  members: Member[] = [],
): CooperativeSummary {
  const rotationMode = normaliseRotationMode(coop.rotationMode);
  const order = getPayoutOrder(members);
  const currentPos = coop.currentRecipientPosition ?? 1;
  const maxPos = order.length;
  const nextPos =
    maxPos > 0 && currentPos < maxPos ? currentPos + 1 : null;

  const status = coop.status ?? 'open';
  const joiningClosed =
    status === 'active' ||
    status === 'completed' ||
    (typeof coop.maxMembers === 'number' &&
      coop.maxMembers > 0 &&
      (coop.memberCount ?? members.length) >= coop.maxMembers);

  return {
    memberCount: coop.memberCount ?? members.length,
    maxMembers: coop.maxMembers ?? null,
    currentRecipientPosition: currentPos,
    nextRecipientPosition: nextPos,
    contributionAmount: coop.contributionAmount,
    contributionFrequency: coop.contributionFrequency,
    status,
    rotationMode,
    rotationModeLabel: ROTATION_MODE_LABELS[rotationMode],
    currentCycle: coop.currentCycle ?? 1,
    joiningClosed,
  };
}

/**
 * Strategy interface for future payout selection (cycle N → recipient).
 * JOIN_ORDER: position N receives during cycle N.
 */
export interface RotationStrategy {
  mode: RotationMode;
  /** Resolve which join position receives payout for a given cycle. */
  resolveRecipientPosition(cycle: number, memberCount: number): number;
}

export const joinOrderStrategy: RotationStrategy = {
  mode: 'JOIN_ORDER',
  resolveRecipientPosition(cycle: number, memberCount: number): number {
    if (memberCount <= 0) return 1;
    // Cycle 1 → position 1, Cycle 2 → position 2, … wraps if needed
    const pos = ((cycle - 1) % memberCount) + 1;
    return pos;
  },
};

/** Registry — add strategies here as they are implemented. */
const STRATEGIES: Partial<Record<RotationMode, RotationStrategy>> = {
  JOIN_ORDER: joinOrderStrategy,
};

export function getRotationStrategy(mode?: RotationMode | string | null): RotationStrategy {
  const normalised = normaliseRotationMode(mode);
  return STRATEGIES[normalised] ?? joinOrderStrategy;
}

/**
 * Human-readable contribution status for member list.
 */
export function contributionStatusLabel(status?: string): string {
  switch (status) {
    case 'waiting':
      return 'Waiting Contribution';
    case 'pending':
      return 'Pending';
    case 'paid':
      return 'Paid';
    case 'overdue':
      return 'Overdue';
    case 'exempt':
      return 'Exempt';
    default:
      return 'Waiting Contribution';
  }
}

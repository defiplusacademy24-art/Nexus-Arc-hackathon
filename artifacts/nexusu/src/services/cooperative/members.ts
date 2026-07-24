/**
 * Member management for a cooperative.
 * Join-order positions are permanent and never reordered.
 * Future-ready: Circle UC wallets, Arc treasury, AI agents.
 */

import type { Member, MemberRole, ContributionStatus } from '@/types';
import type { MemberRegistrationInput } from './types';
import {
  ensureJoinPositions,
  getPayoutOrder,
  nextJoinPosition,
} from './rotation';
import { validateJoin, normaliseEmail } from './validation';
import type { Cooperative } from '@/types';

const key = (coopId: string) => `nexusu:members:${coopId}`;

const DEFAULT_CREDIT_SCORE = 70;
const DEFAULT_CONTRIBUTION_STATUS: ContributionStatus = 'waiting';

export function loadCoopMembers(cooperativeId: string): Member[] {
  try {
    const raw = localStorage.getItem(key(cooperativeId));
    if (!raw) return [];
    const members = JSON.parse(raw) as Member[];
    // Migrate legacy members missing joinPosition
    const migrated = ensureJoinPositions(
      members.map((m) => ({
        ...m,
        contributionStatus: m.contributionStatus ?? DEFAULT_CONTRIBUTION_STATUS,
        hasReceivedPayout: m.hasReceivedPayout ?? false,
        creditScore: m.creditScore ?? DEFAULT_CREDIT_SCORE,
      })),
    );
    // Persist migration if any positions were assigned
    const needsSave = members.some(
      (m, i) => m.joinPosition !== migrated[i]?.joinPosition,
    );
    if (needsSave) saveCoopMembers(cooperativeId, migrated);
    return migrated;
  } catch {
    return [];
  }
}

export function saveCoopMembers(cooperativeId: string, members: Member[]): void {
  localStorage.setItem(key(cooperativeId), JSON.stringify(members));
}

/** Members sorted by permanent payout (join) position. */
export function loadMembersInPayoutOrder(cooperativeId: string): Member[] {
  return getPayoutOrder(loadCoopMembers(cooperativeId)).map((e) => e.member);
}

export function addMember(
  cooperativeId: string,
  member: Omit<Member, 'id'>,
): Member {
  const members = loadCoopMembers(cooperativeId);
  const joinPosition =
    member.joinPosition ?? nextJoinPosition(members.length);
  const newMember: Member = {
    ...member,
    id: `member-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    joinPosition,
    contributionStatus: member.contributionStatus ?? DEFAULT_CONTRIBUTION_STATUS,
    hasReceivedPayout: member.hasReceivedPayout ?? false,
    creditScore: member.creditScore ?? DEFAULT_CREDIT_SCORE,
  };
  saveCoopMembers(cooperativeId, [...members, newMember]);
  return newMember;
}

/**
 * Register a new member with full validation and automatic join-position assignment.
 * joinPosition = currentMembers + 1 (permanent).
 */
export function registerMember(
  cooperative: Cooperative,
  input: MemberRegistrationInput,
): Member {
  const members = loadCoopMembers(cooperative.id);
  validateJoin(cooperative, members, input);

  const joinPosition = nextJoinPosition(members.length);
  const displayName = input.displayName.trim();
  const initials =
    displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase() ||
    input.walletAddress.slice(-4).toUpperCase() ||
    'ME';

  return addMember(cooperative.id, {
    name: displayName,
    email: normaliseEmail(input.email),
    avatar: '',
    initials,
    walletIdentity: input.walletAddress.trim(),
    role: 'member',
    contributionScore: 100,
    riskScore: 0,
    reputation: 3,
    status: 'active',
    joinedAt: new Date().toISOString(),
    totalContributed: 0,
    missedContributions: 0,
    activeLoans: 0,
    joinPosition,
    contributionStatus: 'waiting',
    hasReceivedPayout: false,
    creditScore: DEFAULT_CREDIT_SCORE,
  });
}

/**
 * Create the founder as position #1 when a cooperative is launched.
 */
export function createFounderMember(
  cooperativeId: string,
  walletIdentity: string,
  opts?: { displayName?: string; email?: string },
): Member {
  const members = loadCoopMembers(cooperativeId);
  if (members.length > 0) {
    const existing = members.find(
      (m) =>
        m.walletIdentity.toLowerCase() === walletIdentity.toLowerCase() ||
        m.role === 'founder',
    );
    if (existing) return existing;
  }

  const displayName = opts?.displayName?.trim() || 'You (Founder)';
  const initials =
    displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2) ||
    walletIdentity.slice(-4).toUpperCase() ||
    'ME';

  return addMember(cooperativeId, {
    name: displayName,
    email: opts?.email ? normaliseEmail(opts.email) : '',
    avatar: '',
    initials,
    walletIdentity,
    role: 'founder',
    contributionScore: 100,
    riskScore: 0,
    reputation: 5,
    status: 'active',
    joinedAt: new Date().toISOString(),
    totalContributed: 0,
    missedContributions: 0,
    activeLoans: 0,
    joinPosition: 1,
    contributionStatus: 'waiting',
    hasReceivedPayout: false,
    creditScore: DEFAULT_CREDIT_SCORE,
  });
}

export function updateMemberRole(
  cooperativeId: string,
  memberId: string,
  role: MemberRole,
): void {
  const members = loadCoopMembers(cooperativeId).map((m) =>
    m.id === memberId ? { ...m, role } : m,
  );
  saveCoopMembers(cooperativeId, members);
}

export function updateMemberStatus(
  cooperativeId: string,
  memberId: string,
  status: Member['status'],
): void {
  const members = loadCoopMembers(cooperativeId).map((m) =>
    m.id === memberId ? { ...m, status } : m,
  );
  saveCoopMembers(cooperativeId, members);
}

export function updateContributionStatus(
  cooperativeId: string,
  memberId: string,
  contributionStatus: ContributionStatus,
): void {
  const members = loadCoopMembers(cooperativeId).map((m) =>
    m.id === memberId ? { ...m, contributionStatus } : m,
  );
  saveCoopMembers(cooperativeId, members);
}

export function removeMember(cooperativeId: string, memberId: string): void {
  // Note: removing a member does NOT reassign join positions of remaining members.
  // Payout order for remaining members stays permanent.
  const filtered = loadCoopMembers(cooperativeId).filter((m) => m.id !== memberId);
  saveCoopMembers(cooperativeId, filtered);
}

export function getMemberByWallet(
  cooperativeId: string,
  walletIdentity: string,
): Member | null {
  const w = walletIdentity.toLowerCase();
  return (
    loadCoopMembers(cooperativeId).find(
      (m) => m.walletIdentity.toLowerCase() === w,
    ) ?? null
  );
}

export function getMemberByEmail(
  cooperativeId: string,
  email: string,
): Member | null {
  const e = normaliseEmail(email);
  return (
    loadCoopMembers(cooperativeId).find(
      (m) => m.email && normaliseEmail(m.email) === e,
    ) ?? null
  );
}

export function getMemberByJoinPosition(
  cooperativeId: string,
  position: number,
): Member | null {
  return (
    loadCoopMembers(cooperativeId).find((m) => m.joinPosition === position) ??
    null
  );
}

/** Broadcast so Members / Cooperatives pages can refresh live. */
export function emitMembersUpdated(cooperativeId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('nexusu:members-updated', { detail: { cooperativeId } }),
  );
}

/**
 * Credit a member's totalContributed after a deposit / contribution.
 * Used when treasury records money movement so the Members "Contributed" column stays live.
 */
export function applyWalletContribution(
  cooperativeId: string,
  walletIdentity: string,
  amount: number,
): Member | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const w = walletIdentity.trim().toLowerCase();
  if (!w) return null;

  const members = loadCoopMembers(cooperativeId);
  let updated: Member | null = null;
  const next = members.map((m) => {
    if (m.walletIdentity.toLowerCase() !== w) return m;
    updated = {
      ...m,
      totalContributed: Math.round(((m.totalContributed ?? 0) + amount) * 100) / 100,
      contributionStatus: 'paid' as ContributionStatus,
    };
    return updated;
  });

  if (!updated) return null;
  saveCoopMembers(cooperativeId, next);
  emitMembersUpdated(cooperativeId);
  return updated;
}

/**
 * Merge backend member totals into local roster (by wallet).
 * Takes the higher totalContributed so we never lose a local credit mid-sync.
 */
export function mergeRemoteMemberTotals(
  cooperativeId: string,
  remote: Array<{
    walletIdentity?: string;
    totalContributed?: number;
    contributionStatus?: string;
    name?: string;
    joinPosition?: number;
  }>,
): Member[] {
  if (!remote.length) return loadMembersInPayoutOrder(cooperativeId);

  const members = loadCoopMembers(cooperativeId);
  const byWallet = new Map(
    remote
      .filter((r) => r.walletIdentity)
      .map((r) => [r.walletIdentity!.toLowerCase(), r]),
  );

  let changed = false;
  const next = members.map((m) => {
    const r = byWallet.get(m.walletIdentity.toLowerCase());
    if (!r) return m;
    const remoteTotal = Number(r.totalContributed ?? 0);
    const localTotal = m.totalContributed ?? 0;
    const totalContributed = Math.max(localTotal, remoteTotal);
    const contributionStatus =
      (r.contributionStatus as ContributionStatus | undefined) ??
      m.contributionStatus;
    if (
      totalContributed !== localTotal ||
      (contributionStatus && contributionStatus !== m.contributionStatus)
    ) {
      changed = true;
      return {
        ...m,
        totalContributed,
        contributionStatus: contributionStatus ?? m.contributionStatus,
      };
    }
    return m;
  });

  if (changed) {
    saveCoopMembers(cooperativeId, next);
    emitMembersUpdated(cooperativeId);
  }
  return getPayoutOrder(next).map((e) => e.member);
}

/**
 * Recompute each member's totalContributed from deposit/contribution txs (by wallet).
 * Useful when backend member rows and local roster need to catch up after deposits.
 */
export function recomputeContributionsFromTransactions(
  cooperativeId: string,
  transactions: Array<{
    walletIdentity?: string;
    type?: string;
    amount?: number;
  }>,
): Member[] {
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (!t.walletIdentity) continue;
    if (t.type !== 'deposit' && t.type !== 'contribution') continue;
    const amt = Number(t.amount ?? 0);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    const w = t.walletIdentity.toLowerCase();
    totals.set(w, Math.round(((totals.get(w) ?? 0) + amt) * 100) / 100);
  }

  const members = loadCoopMembers(cooperativeId);
  let changed = false;
  const next = members.map((m) => {
    const fromTx = totals.get(m.walletIdentity.toLowerCase());
    if (fromTx == null) return m;
    const local = m.totalContributed ?? 0;
    // Prefer ledger sum when it is higher (source of truth for deposits)
    if (fromTx > local) {
      changed = true;
      return {
        ...m,
        totalContributed: fromTx,
        contributionStatus: 'paid' as ContributionStatus,
      };
    }
    return m;
  });

  if (changed) {
    saveCoopMembers(cooperativeId, next);
    emitMembersUpdated(cooperativeId);
  }
  return getPayoutOrder(changed ? next : members).map((e) => e.member);
}

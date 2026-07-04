/**
 * Member management for a cooperative.
 * Future-ready: replace localStorage with Sphere wallet-to-wallet identity checks.
 */

import type { Member, MemberRole } from '@/types';

const key = (coopId: string) => `nexusu:members:${coopId}`;

export function loadCoopMembers(cooperativeId: string): Member[] {
  try {
    const raw = localStorage.getItem(key(cooperativeId));
    return raw ? (JSON.parse(raw) as Member[]) : [];
  } catch {
    return [];
  }
}

export function saveCoopMembers(cooperativeId: string, members: Member[]): void {
  localStorage.setItem(key(cooperativeId), JSON.stringify(members));
}

export function addMember(
  cooperativeId: string,
  member: Omit<Member, 'id'>,
): Member {
  const members = loadCoopMembers(cooperativeId);
  const newMember: Member = {
    ...member,
    id: `member-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  };
  saveCoopMembers(cooperativeId, [...members, newMember]);
  return newMember;
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

export function removeMember(cooperativeId: string, memberId: string): void {
  const filtered = loadCoopMembers(cooperativeId).filter((m) => m.id !== memberId);
  saveCoopMembers(cooperativeId, filtered);
}

export function getMemberByWallet(
  cooperativeId: string,
  walletIdentity: string,
): Member | null {
  return (
    loadCoopMembers(cooperativeId).find((m) => m.walletIdentity === walletIdentity) ?? null
  );
}

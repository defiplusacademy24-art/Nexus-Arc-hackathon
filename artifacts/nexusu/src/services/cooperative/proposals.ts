/**
 * Governance proposals — localStorage until on-chain voting is integrated.
 * Starts empty; never seeds mock proposals.
 */

import type { Proposal } from '@/types';

const key = (coopId: string) => `nexusu:proposals:${coopId}`;

export function loadProposals(cooperativeId: string): Proposal[] {
  try {
    const raw = localStorage.getItem(key(cooperativeId));
    return raw ? (JSON.parse(raw) as Proposal[]) : [];
  } catch {
    return [];
  }
}

export function saveProposals(cooperativeId: string, proposals: Proposal[]): void {
  localStorage.setItem(key(cooperativeId), JSON.stringify(proposals));
}

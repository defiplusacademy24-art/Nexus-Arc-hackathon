/**
 * Savings pools — localStorage until on-chain pools are integrated.
 * Starts empty; never seeds mock pools.
 */

import type { SavingsPool } from '@/types';

const key = (coopId: string) => `nexusu:savings:${coopId}`;

export function loadSavingsPools(cooperativeId: string): SavingsPool[] {
  try {
    const raw = localStorage.getItem(key(cooperativeId));
    return raw ? (JSON.parse(raw) as SavingsPool[]) : [];
  } catch {
    return [];
  }
}

export function saveSavingsPools(cooperativeId: string, pools: SavingsPool[]): void {
  localStorage.setItem(key(cooperativeId), JSON.stringify(pools));
}

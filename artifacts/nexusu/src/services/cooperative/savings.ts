/**
 * Savings service — Cooperative Savings Vault only.
 * Personal "create pool" UX has been removed.
 */

export { buildSavingsVaultSnapshot, totalInterestEarned } from './savings-vault';
export type { } from '@/types';

/** @deprecated Use buildSavingsVaultSnapshot — pools are no longer supported */
export function loadSavingsPools(_cooperativeId: string): never[] {
  return [];
}

/** @deprecated */
export function saveSavingsPools(_cooperativeId: string, _pools: unknown[]): void {
  // no-op
}

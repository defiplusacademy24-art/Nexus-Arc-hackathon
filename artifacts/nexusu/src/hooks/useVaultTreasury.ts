/**
 * Single source of truth for cooperative treasury cash display.
 *
 * When the active cooperative has an isolated Arc vault, never paint stale
 * localStorage / API `treasuryBalance` while the chain is still loading.
 * Each workspace must use its own vault address — never a shared global vault.
 */

import { useCallback, useEffect, useState } from 'react';
import { useCooperative } from '@/providers/CooperativeProvider';
import {
  fetchVaultSnapshot,
  isVaultConfigured,
} from '@/services/treasury/vault';

export type VaultTreasuryState = {
  /** Cash to show when ready; 0 while loading with vault (do not treat as real). */
  balance: number;
  /** True until the first successful vault read (or error) when vault is configured. */
  isLoading: boolean;
  /** Active coop has an isolated vault (or legacy global only when no multi-coop address). */
  vaultConfigured: boolean;
  /** Chain read finished (success or failure). Always true when vault is off. */
  isReady: boolean;
  /** Last fetch failed (vault mode only). */
  error: boolean;
  paidCount: number;
  requiredCount: number;
  contributionAmount: number;
  currentCycle: number;
  /** Re-fetch on-chain balance. */
  refresh: () => Promise<void>;
};

export function useVaultTreasury(
  walletAddress?: string | null,
): VaultTreasuryState {
  const { activeCooperative, updateCooperative } = useCooperative();
  const coopVault = activeCooperative?.treasuryVaultAddress ?? null;
  // Only treat as on-chain when THIS workspace has a vault address
  const vaultConfigured = isVaultConfigured(coopVault);

  const [chainBalance, setChainBalance] = useState<number | null>(null);
  const [paidCount, setPaidCount] = useState(0);
  const [requiredCount, setRequiredCount] = useState(0);
  const [contributionAmount, setContributionAmount] = useState(0);
  const [currentCycle, setCurrentCycle] = useState(0);
  const [isLoading, setIsLoading] = useState(vaultConfigured);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!vaultConfigured || !coopVault) {
      setChainBalance(null);
      setIsLoading(false);
      setError(false);
      return;
    }

    setIsLoading(true);
    setError(false);
    try {
      const snap = await fetchVaultSnapshot(walletAddress ?? undefined, coopVault);
      setChainBalance(snap.totalBalance);
      setPaidCount(snap.paidCount);
      setRequiredCount(snap.requiredCount);
      setContributionAmount(snap.contributionAmount);
      setCurrentCycle(snap.currentCycle);
      if (
        activeCooperative &&
        (activeCooperative.treasuryBalance ?? 0) !== snap.totalBalance
      ) {
        updateCooperative(activeCooperative.id, {
          treasuryBalance: snap.totalBalance,
        });
      }
    } catch {
      setChainBalance(null);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [vaultConfigured, coopVault, walletAddress, activeCooperative, updateCooperative]);

  useEffect(() => {
    if (vaultConfigured) {
      setChainBalance(null);
      setIsLoading(true);
      setError(false);
    }
    void refresh();
  }, [walletAddress, activeCooperative?.id, vaultConfigured, coopVault]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!vaultConfigured) {
    return {
      balance: activeCooperative?.treasuryBalance ?? 0,
      isLoading: false,
      vaultConfigured: false,
      isReady: true,
      error: false,
      paidCount: 0,
      requiredCount: 0,
      contributionAmount: activeCooperative?.contributionAmount ?? 0,
      currentCycle: activeCooperative?.currentCycle ?? 0,
      refresh,
    };
  }

  const stillWaiting = isLoading || (chainBalance === null && !error);

  return {
    balance: chainBalance ?? 0,
    isLoading: stillWaiting,
    vaultConfigured: true,
    isReady: !stillWaiting,
    error,
    paidCount,
    requiredCount,
    contributionAmount,
    currentCycle,
    refresh,
  };
}

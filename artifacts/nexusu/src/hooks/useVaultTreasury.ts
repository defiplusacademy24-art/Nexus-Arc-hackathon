/**
 * Single source of truth for cooperative treasury cash display.
 *
 * When the Arc vault is configured, never paint stale localStorage / API
 * `treasuryBalance` while the chain is still loading — that caused $200 (etc.)
 * flashes on Overview / Analytics / Treasury before real figures appeared.
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
  /** Vault is wired in env / config. */
  vaultConfigured: boolean;
  /** Chain read finished (success or failure). Always true when vault is off. */
  isReady: boolean;
  /** Last fetch failed (vault mode only). */
  error: boolean;
  /** Re-fetch on-chain balance. */
  refresh: () => Promise<void>;
};

export function useVaultTreasury(
  walletAddress?: string | null,
): VaultTreasuryState {
  const { activeCooperative, updateCooperative } = useCooperative();
  const vaultConfigured = isVaultConfigured();

  const [chainBalance, setChainBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(vaultConfigured);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!vaultConfigured) {
      setChainBalance(null);
      setIsLoading(false);
      setError(false);
      return;
    }

    setIsLoading(true);
    setError(false);
    try {
      const snap = await fetchVaultSnapshot(walletAddress ?? undefined);
      setChainBalance(snap.totalBalance);
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
  }, [vaultConfigured, walletAddress, activeCooperative, updateCooperative]);

  useEffect(() => {
    // Clear prior coop’s balance immediately so we never flash the wrong coop.
    if (vaultConfigured) {
      setChainBalance(null);
      setIsLoading(true);
      setError(false);
    }
    void refresh();
  }, [walletAddress, activeCooperative?.id, vaultConfigured]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: re-fetch on coop/wallet change only

  if (!vaultConfigured) {
    return {
      balance: activeCooperative?.treasuryBalance ?? 0,
      isLoading: false,
      vaultConfigured: false,
      isReady: true,
      error: false,
      refresh,
    };
  }

  const stillWaiting = isLoading || (chainBalance === null && !error);

  return {
    // While loading, expose 0 but isLoading=true so UI shows skeleton, not $0 as truth.
    // On error, balance 0 + isReady so the UI can settle without a stale cache flash.
    balance: chainBalance ?? 0,
    isLoading: stillWaiting,
    vaultConfigured: true,
    isReady: !stillWaiting,
    error,
    refresh,
  };
}

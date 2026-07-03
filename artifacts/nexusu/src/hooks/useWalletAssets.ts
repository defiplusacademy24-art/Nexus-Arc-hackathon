/**
 * useWalletAssets — fetches wallet asset balances via the Sphere SDK.
 * Returns loading/error/data state. Never invents fake balances.
 */

import { useState, useEffect, useCallback } from 'react';
import { useUnicity } from '@/providers/UnicityProvider';
import { fetchWalletAssets, type WalletAssetsResult, EMPTY_ASSETS } from '@/services/unicity/assets';

export interface UseWalletAssetsState {
  data: WalletAssetsResult | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useWalletAssets(): UseWalletAssetsState {
  const { isConnected, query } = useUnicity();
  const [data, setData] = useState<WalletAssetsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchWalletAssets(query);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
      setData({ ...EMPTY_ASSETS, lastUpdated: new Date() });
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, query]);

  useEffect(() => {
    if (isConnected) {
      void load();
    } else {
      setData(null);
    }
  }, [isConnected, load]);

  return { data, isLoading, error, refresh: load };
}

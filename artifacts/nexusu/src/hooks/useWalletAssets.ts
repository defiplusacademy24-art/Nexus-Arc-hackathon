/**
 * useWalletAssets — reads USDC balances on Arc Testnet via viem public client.
 * Does not depend on wagmi (Circle email wallets are not injected connectors).
 */

import { useCallback, useEffect, useState } from 'react';
import { createPublicClient, erc20Abi, http } from 'viem';
import { useWallet } from '@/providers/WalletProvider';
import { ARC_RPC_URL, ARC_USDC_ERC20_ADDRESS, arcTestnet } from '@/config/arc';
import {
  buildErc20UsdcAsset,
  buildNativeUsdcAsset,
  mergeAssets,
  EMPTY_ASSETS,
  type WalletAssetsResult,
} from '@/services/wallet/assets';

export interface UseWalletAssetsState {
  data: WalletAssetsResult | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_RPC_URL),
});

export function useWalletAssets(): UseWalletAssetsState {
  const { isConnected, walletAddress } = useWallet();
  const [data, setData] = useState<WalletAssetsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const address = walletAddress as `0x${string}`;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [native, erc20] = await Promise.all([
          publicClient.getBalance({ address }),
          publicClient.readContract({
            address: ARC_USDC_ERC20_ADDRESS,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [address],
          }) as Promise<bigint>,
        ]);

        if (cancelled) return;
        setData(
          mergeAssets(buildNativeUsdcAsset(native), buildErc20UsdcAsset(erc20)),
        );
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load balances');
        setData(EMPTY_ASSETS);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isConnected, walletAddress, tick]);

  return {
    data: data ?? (isConnected ? EMPTY_ASSETS : null),
    isLoading,
    error,
    refresh,
  };
}

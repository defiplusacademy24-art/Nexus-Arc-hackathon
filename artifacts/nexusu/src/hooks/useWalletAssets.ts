/**
 * useWalletAssets — reads USDC balances on Arc Testnet via viem/wagmi.
 */

import { useMemo } from 'react';
import { erc20Abi } from 'viem';
import { useBalance, useReadContract } from 'wagmi';
import { useWallet } from '@/providers/WalletProvider';
import { ARC_USDC_ERC20_ADDRESS } from '@/config/arc';
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

export function useWalletAssets(): UseWalletAssetsState {
  const { isConnected, walletAddress } = useWallet();

  const {
    data: nativeBalance,
    isLoading: nativeLoading,
    error: nativeError,
    refetch: refetchNative,
  } = useBalance({
    address: walletAddress as `0x${string}` | undefined,
    query: { enabled: isConnected && Boolean(walletAddress) },
  });

  const {
    data: erc20Balance,
    isLoading: erc20Loading,
    error: erc20Error,
    refetch: refetchErc20,
  } = useReadContract({
    address: ARC_USDC_ERC20_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress as `0x${string}`] : undefined,
    query: { enabled: isConnected && Boolean(walletAddress) },
  });

  const data = useMemo<WalletAssetsResult | null>(() => {
    if (!isConnected) return null;

    const nativeAsset =
      nativeBalance?.value !== undefined
        ? buildNativeUsdcAsset(nativeBalance.value)
        : null;

    const erc20Asset =
      erc20Balance !== undefined ? buildErc20UsdcAsset(erc20Balance as bigint) : null;

    return mergeAssets(nativeAsset, erc20Asset);
  }, [isConnected, nativeBalance?.value, erc20Balance]);

  const error =
    nativeError?.message ?? erc20Error?.message ?? null;

  return {
    data: data ?? (isConnected ? EMPTY_ASSETS : null),
    isLoading: nativeLoading || erc20Loading,
    error,
    refresh: () => {
      void refetchNative();
      void refetchErc20();
    },
  };
}
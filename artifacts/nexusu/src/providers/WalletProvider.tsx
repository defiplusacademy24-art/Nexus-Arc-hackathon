/**
 * WalletProvider — Arc Testnet wallet connection via wagmi + Reown AppKit.
 * Replaces the former Unicity Sphere wallet integration.
 */

import { useEffect, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import {
  ensureAppKit,
  hasWalletConnectProjectId,
  wagmiConfig,
} from '@/config/wagmi';
import { WalletContextBridge, useWalletContext } from '@/providers/WalletContextBridge';
import { WalletContextWithAppKit } from '@/providers/WalletContextWithAppKit';

export type { UseWallet, WalletState } from '@/hooks/useWalletConnection';

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  useEffect(() => {
    ensureAppKit();
  }, []);

  const Inner = hasWalletConnectProjectId()
    ? WalletContextWithAppKit
    : WalletContextBridge;

  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount>
      <Inner>{children}</Inner>
    </WagmiProvider>
  );
}

export function useWallet() {
  return useWalletContext();
}

/** @deprecated Use useWallet */
export const useUnicity = useWallet;
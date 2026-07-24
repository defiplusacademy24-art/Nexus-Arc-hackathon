/**
 * WalletProvider — Circle email OTP wallets only (Polaris-style).
 * No MetaMask / WalletConnect / AppKit connect path.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useCircleEmailWallet } from '@/hooks/useCircleEmailWallet';
import { mapEvmAddress, type NexusuIdentity } from '@/services/wallet';
import { ARC_TESTNET_CHAIN_ID } from '@/config/arc';
import type { UseWallet, WalletState } from '@/hooks/useWalletConnection';

export type { UseWallet, WalletState };

const WalletContext = createContext<UseWallet | null>(null);

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const circle = useCircleEmailWallet();

  const notSupported = useCallback(async () => {
    throw new Error('Only Circle email login is supported');
  }, []);

  const value = useMemo<UseWallet>(() => {
    const address = circle.uc?.address ?? null;
    const identity: NexusuIdentity | null = address ? mapEvmAddress(address) : null;
    const isConnected = Boolean(circle.uc);

    return {
      isConnected,
      isConnecting: circle.isConnectingEmail,
      isWalletLocked: false,
      identity,
      error: circle.emailError,
      connect: notSupported,
      connectViaExtension: notSupported,
      connectViaPopup: notSupported,
      connectWithWallet: notSupported,
      connectWithProvider: notSupported,
      connectWithEmail: circle.connectWithEmail,
      disconnect: async () => {
        circle.disconnectEmail();
      },
      reconnect: notSupported,
      isAutoConnecting: false,
      extensionInstalled: false,
      walletConnectEnabled: false,
      circleEmailEnabled: circle.circleEmailEnabled,
      lastUcEmail: circle.lastUcEmail,
      isMobileBrowser: false,
      isWalletInAppBrowser: false,
      walletAddress: address,
      publicKey: null,
      session: circle.uc?.userToken ?? null,
      chainId: isConnected ? ARC_TESTNET_CHAIN_ID : null,
      isOnArcTestnet: isConnected,
      isCircleEmailWallet: isConnected,
    };
  }, [circle, notSupported]);

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): UseWallet {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used inside <WalletProvider>');
  }
  return ctx;
}

/** @deprecated Use useWallet */
export const useUnicity = useWallet;

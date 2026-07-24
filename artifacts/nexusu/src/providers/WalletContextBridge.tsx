import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import type { UseWallet } from '@/hooks/useWalletConnection';
import { useCircleEmailWallet } from '@/hooks/useCircleEmailWallet';
import { mapEvmAddress } from '@/services/wallet';
import { ARC_TESTNET_CHAIN_ID } from '@/config/arc';

const WalletContext = createContext<UseWallet | null>(null);

interface WalletContextBridgeProps {
  children: ReactNode;
  openModal?: () => Promise<void>;
}

export function WalletContextBridge({ children, openModal }: WalletContextBridgeProps) {
  const wagmi = useWalletConnection(openModal);
  const circle = useCircleEmailWallet();

  const value = useMemo<UseWallet>(() => {
    const isCircle = Boolean(circle.uc);
    const address = circle.uc?.address ?? wagmi.walletAddress;
    const identity = address ? mapEvmAddress(address) : null;

    return {
      ...wagmi,
      isConnected: isCircle || wagmi.isConnected,
      isConnecting: circle.isConnectingEmail || wagmi.isConnecting,
      identity,
      error: circle.emailError ?? wagmi.error,
      walletAddress: address,
      chainId: isCircle ? ARC_TESTNET_CHAIN_ID : wagmi.chainId,
      isOnArcTestnet: isCircle ? true : wagmi.isOnArcTestnet,
      isCircleEmailWallet: isCircle,
      circleEmailEnabled: circle.circleEmailEnabled,
      lastUcEmail: circle.lastUcEmail,
      connectWithEmail: circle.connectWithEmail,
      disconnect: async () => {
        if (isCircle) {
          circle.disconnectEmail();
        }
        if (wagmi.isConnected) {
          await wagmi.disconnect();
        }
      },
    };
  }, [wagmi, circle]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWalletContext(): UseWallet {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used inside <WalletProvider>');
  }
  return ctx;
}
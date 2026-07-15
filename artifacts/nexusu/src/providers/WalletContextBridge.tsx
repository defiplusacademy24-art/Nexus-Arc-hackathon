import { createContext, useContext, type ReactNode } from 'react';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import type { UseWallet } from '@/hooks/useWalletConnection';

const WalletContext = createContext<UseWallet | null>(null);

interface WalletContextBridgeProps {
  children: ReactNode;
  openModal?: () => Promise<void>;
}

export function WalletContextBridge({ children, openModal }: WalletContextBridgeProps) {
  const value = useWalletConnection(openModal);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWalletContext(): UseWallet {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used inside <WalletProvider>');
  }
  return ctx;
}
/**
 * useSession — wallet session metadata for Arc Testnet connections.
 */

import { useMemo } from 'react';
import { useWallet } from '@/providers/WalletProvider';
import { loadIdentity } from '@/services/wallet/session';
import { ARC_NETWORK_LABEL } from '@/services/wallet/constants';

export interface SessionInfo {
  isConnected: boolean;
  session: string | null;
  extensionInstalled: boolean;
  network: string;
  chainId: number | null;
  isOnArcTestnet: boolean;
  authMethod: string;
  deviceLabel: string;
  connectedAtLabel: string;
  isSecure: boolean;
}

function formatConnectedAt(connectedAt?: number): string {
  if (!connectedAt) return 'Active now';
  return new Date(connectedAt).toLocaleString();
}

export function useSession(): SessionInfo {
  const {
    isConnected,
    extensionInstalled,
    chainId,
    isOnArcTestnet,
  } = useWallet();

  return useMemo(() => {
    const stored = loadIdentity();
    const isSecure =
      typeof window !== 'undefined' ? window.location.protocol === 'https:' : true;

    return {
      isConnected,
      session: null,
      extensionInstalled,
      network: ARC_NETWORK_LABEL,
      chainId,
      isOnArcTestnet,
      authMethod: extensionInstalled ? 'Browser Wallet' : 'WalletConnect',
      deviceLabel: typeof navigator !== 'undefined' ? navigator.platform || 'This device' : 'This device',
      connectedAtLabel: formatConnectedAt(stored?.connectedAt),
      isSecure,
    };
  }, [isConnected, extensionInstalled, chainId, isOnArcTestnet]);
}
/**
 * useIdentity — exposes the connected Arc wallet identity with UI metadata.
 */

import { useMemo } from 'react';
import { useWallet } from '@/providers/WalletProvider';
import { loadIdentity } from '@/services/wallet/session';
import { ARC_NETWORK_LABEL } from '@/services/wallet/constants';

export interface IdentityDetails {
  walletAddress: string;
  publicKey: string;
  nametag?: string;
  displayName: string;
  shortAddress: string;
  network: string;
  connectionAgeLabel: string;
}

function formatConnectionAge(connectedAt?: number): string {
  if (!connectedAt) return 'Just now';
  const mins = Math.floor((Date.now() - connectedAt) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function useIdentity(): IdentityDetails | null {
  const { identity, isConnected } = useWallet();

  return useMemo(() => {
    if (!isConnected || !identity) return null;

    const stored = loadIdentity();

    return {
      walletAddress: identity.walletAddress,
      publicKey: identity.publicKey,
      nametag: identity.nametag,
      displayName: identity.displayName,
      shortAddress: identity.shortAddress,
      network: ARC_NETWORK_LABEL,
      connectionAgeLabel: formatConnectionAge(stored?.connectedAt),
    };
  }, [identity, isConnected]);
}
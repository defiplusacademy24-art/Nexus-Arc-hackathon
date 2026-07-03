/**
 * useIdentity — enriched identity hook.
 * Wraps the raw wallet context with session metadata from storage.
 */

import { useMemo } from 'react';
import { useUnicity } from '@/providers/UnicityProvider';
import { loadIdentity } from '@/services/unicity/session';
import { truncateAddress } from '@/services/unicity/identity';

export interface IdentityDetails {
  walletAddress: string;
  shortAddress: string;
  publicKey: string;
  nametag: string | undefined;
  displayName: string;
  connectedAt: Date | null;
  connectionAgeLabel: string;
  isVerified: boolean;
  network: string;
}

function formatConnectionAge(connectedAt: number): string {
  const diff = Date.now() - connectedAt;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

export function useIdentity(): IdentityDetails | null {
  const { identity, isConnected } = useUnicity();

  return useMemo(() => {
    if (!isConnected || !identity) return null;

    const stored = loadIdentity();
    const connectedAt = stored?.connectedAt ? new Date(stored.connectedAt) : null;

    return {
      walletAddress: identity.walletAddress,
      shortAddress: truncateAddress(identity.walletAddress, 10, 8),
      publicKey: identity.publicKey,
      nametag: identity.nametag,
      displayName: identity.displayName,
      connectedAt,
      connectionAgeLabel: stored?.connectedAt
        ? formatConnectionAge(stored.connectedAt)
        : 'This session',
      isVerified: true,
      network: 'Unicity testnet2',
    };
  }, [identity, isConnected]);
}

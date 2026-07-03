/**
 * Identity helpers for Nexusu.
 * Maps the raw PublicIdentity from @unicitylabs/sphere-sdk into a
 * Nexusu-friendly shape, avoiding all crypto/blockchain jargon in the UI.
 */

import type { PublicIdentity } from '@unicitylabs/sphere-sdk/connect';

export interface NexusuIdentity {
  /** Primary L3 DIRECT address — the user's decentralised identity */
  walletAddress: string;
  /** 33-byte compressed secp256k1 public key */
  publicKey: string;
  /** Human-readable @username if the user has registered a nametag */
  nametag?: string;
  /** Best display name: nametag → truncated address */
  displayName: string;
  /** Short representation for UI badges */
  shortAddress: string;
}

export function mapIdentity(raw: PublicIdentity): NexusuIdentity {
  const r = raw as unknown as Record<string, unknown>;
  const walletAddress = (r['directAddress'] as string | undefined) ?? (r['chainPubkey'] as string | undefined) ?? '';
  const publicKey = (r['chainPubkey'] as string | undefined) ?? '';
  const nametag = r['nametag'] as string | undefined;
  const displayName = nametag ? `@${nametag}` : truncateAddress(walletAddress);
  const shortAddress = truncateAddress(walletAddress);

  return { walletAddress, publicKey, nametag, displayName, shortAddress };
}

export function truncateAddress(address: string, start = 8, end = 6): string {
  if (!address) return '';
  if (address.length <= start + end + 3) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

export interface NexusuIdentity {
  /** EVM wallet address on Arc Testnet */
  walletAddress: string;
  /** Not used for EVM wallets — kept for compatibility */
  publicKey: string;
  nametag?: string;
  displayName: string;
  shortAddress: string;
}

export function truncateAddress(address: string, start = 6, end = 4): string {
  if (!address) return '';
  if (address.length <= start + end + 3) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

export function mapEvmAddress(address: string): NexusuIdentity {
  return {
    walletAddress: address,
    publicKey: '',
    displayName: truncateAddress(address),
    shortAddress: truncateAddress(address),
  };
}
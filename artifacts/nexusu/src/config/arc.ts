import { fallback, http, type Transport } from 'viem';
import { arcTestnet as viemArcTestnet } from 'viem/chains';

/** Arc Testnet — Circle's L1 for programmable money (USDC gas). */
export const ARC_TESTNET_CHAIN_ID = 5042002 as const;

/** Primary public RPC (can rate-limit under load). */
export const ARC_RPC_URL =
  (typeof import.meta !== 'undefined' &&
    (import.meta as ImportMeta & { env?: { VITE_ARC_RPC_URL?: string } }).env
      ?.VITE_ARC_RPC_URL) ||
  'https://rpc.testnet.arc.network';

/**
 * Fallback public RPCs when the primary is rate-limited.
 * @see https://docs.arc.network / chainlist
 */
export const ARC_RPC_FALLBACKS = [
  ARC_RPC_URL,
  'https://rpc.testnet.arc.network',
  'https://arc-testnet.drpc.org',
  'https://rpc.drpc.testnet.arc.io',
  'https://5042002.rpc.thirdweb.com',
].filter((u, i, a) => Boolean(u) && a.indexOf(u) === i);

export const ARC_EXPLORER_URL = 'https://testnet.arcscan.app';

/** USDC ERC-20 interface on Arc Testnet (6 decimals). */
export const ARC_USDC_ERC20_ADDRESS =
  '0x3600000000000000000000000000000000000000' as const;

export const ARC_FAUCET_URL = 'https://faucet.circle.com';

export const arcTestnet = viemArcTestnet;

/** Resilient HTTP transport: failover + retries for busy public RPCs. */
export function createArcTransport(): Transport {
  return fallback(
    ARC_RPC_FALLBACKS.map((url) =>
      http(url, {
        timeout: 25_000,
        retryCount: 3,
        retryDelay: 1_200,
      }),
    ),
    { rank: false },
  );
}

/** Add/switch Arc Testnet in injected wallets (EIP-3085). */
export const ARC_TESTNET_WALLET_PARAMS = {
  chainId: `0x${ARC_TESTNET_CHAIN_ID.toString(16)}`,
  chainName: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: ARC_RPC_FALLBACKS,
  blockExplorerUrls: [ARC_EXPLORER_URL],
} as const;
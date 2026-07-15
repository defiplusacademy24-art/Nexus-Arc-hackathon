import { arcTestnet as viemArcTestnet } from 'viem/chains';

/** Arc Testnet — Circle's L1 for programmable money (USDC gas). */
export const ARC_TESTNET_CHAIN_ID = 5042002 as const;

export const ARC_RPC_URL = 'https://rpc.testnet.arc.network';

export const ARC_EXPLORER_URL = 'https://testnet.arcscan.app';

/** USDC ERC-20 interface on Arc Testnet (6 decimals). */
export const ARC_USDC_ERC20_ADDRESS =
  '0x3600000000000000000000000000000000000000' as const;

export const ARC_FAUCET_URL = 'https://faucet.circle.com';

export const arcTestnet = viemArcTestnet;

/** Add/switch Arc Testnet in injected wallets (EIP-3085). */
export const ARC_TESTNET_WALLET_PARAMS = {
  chainId: `0x${ARC_TESTNET_CHAIN_ID.toString(16)}`,
  chainName: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: [ARC_RPC_URL],
  blockExplorerUrls: [ARC_EXPLORER_URL],
} as const;
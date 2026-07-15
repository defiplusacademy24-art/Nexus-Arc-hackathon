import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { createAppKit } from '@reown/appkit/react';
import { mainnet } from '@reown/appkit/networks';
import { createConfig, http } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { ARC_RPC_URL } from '@/config/arc';
import { arcTestnetAppKit } from '@/config/arc-appkit';
import { NEXUSU_DAPP } from '@/services/wallet/constants';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? '';

const metadata = {
  name: NEXUSU_DAPP.name,
  description: NEXUSU_DAPP.description,
  url: NEXUSU_DAPP.url,
  icons: [`${NEXUSU_DAPP.url}/logo.png`],
};

/** Mainnet included for ENS lookups in wallet modals (per Arc docs). */
export const wagmiChains = [arcTestnetAppKit, mainnet] as const;

const transports = {
  [arcTestnetAppKit.id]: http(ARC_RPC_URL),
  [mainnet.id]: http('https://cloudflare-eth.com'),
} as const;

/** Popular wallets surfaced first in the connect modal. */
const FEATURED_WALLET_IDS = [
  'c57ca95a47575e86e699fcf422c67db1c45b86f1', // MetaMask
  'fd20dc426fb37566d803205b19bbc1d4096b248ac', // Coinbase Wallet
  '4622a2b2d6af1c9844954851', // Trust Wallet
  '1ae92b26df02f08185eeadb4e68794', // Rainbow
  '041e2bd591a563aa02fe16586e84b590', // Rabby
];

function createInjectedConfig() {
  const connectors = projectId
    ? [
        injected({ shimDisconnect: true }),
        walletConnect({
          projectId,
          metadata,
          showQrModal: true,
        }),
      ]
    : [injected({ shimDisconnect: true })];

  return createConfig({
    chains: wagmiChains,
    connectors,
    transports,
    ssr: false,
  });
}

function createAppKitConfig() {
  const adapter = new WagmiAdapter({
    networks: [...wagmiChains],
    projectId,
    transports,
  });
  return { config: adapter.wagmiConfig, adapter };
}

const appKitBundle = projectId ? createAppKitConfig() : null;

export const wagmiConfig = appKitBundle?.config ?? createInjectedConfig();

export const wagmiAdapter = appKitBundle?.adapter ?? null;

let appKitInitialized = false;

export function ensureAppKit(): void {
  if (appKitInitialized || typeof window === 'undefined' || !projectId || !wagmiAdapter) return;

  createAppKit({
    adapters: [wagmiAdapter],
    networks: [...wagmiChains],
    defaultNetwork: arcTestnetAppKit,
    projectId,
    metadata,
    themeMode: 'dark',
    themeVariables: {
      '--w3m-accent': '#6393C4',
      '--w3m-border-radius-master': '12px',
    },
    allWallets: 'SHOW',
    featuredWalletIds: FEATURED_WALLET_IDS,
    enableWallets: true,
    enableEIP6963: true,
    enableInjected: true,
    enableCoinbase: true,
    enableWalletConnect: true,
    enableReconnect: true,
    features: {
      analytics: false,
      email: false,
      socials: false,
      swaps: false,
      onramp: false,
    },
  });

  appKitInitialized = true;
}

export function hasWalletConnectProjectId(): boolean {
  return Boolean(projectId);
}
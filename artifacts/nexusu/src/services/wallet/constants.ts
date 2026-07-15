export const WALLET_INSTALL_URL = 'https://metamask.io/download/';

export const ARC_FAUCET_URL = 'https://faucet.circle.com';

export const ARC_NETWORK_LABEL = 'Arc Testnet';

export const NEXUSU_DAPP = {
  name: 'Nexusu',
  description: 'The Autonomous Community Banking Network on Arc',
  url: typeof location !== 'undefined' ? location.origin : 'https://nexusu.app',
} as const;
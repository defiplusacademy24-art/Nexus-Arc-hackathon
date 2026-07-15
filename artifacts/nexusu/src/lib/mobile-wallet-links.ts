export interface MobileWalletOption {
  id: string;
  name: string;
  rdns?: string;
  installUrl: string;
  /** Opens the dapp inside the wallet app's browser on mobile. */
  getMobileLink: (dappUrl: string) => string;
}

export const MOBILE_WALLET_OPTIONS: MobileWalletOption[] = [
  {
    id: 'metamask',
    name: 'MetaMask',
    rdns: 'io.metamask',
    installUrl: 'https://metamask.io/download/',
    getMobileLink: (url) => `https://metamask.app.link/dapp/${encodeURIComponent(url)}`,
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    installUrl: 'https://rainbow.me/download',
    getMobileLink: (url) => `https://rnbwapp.com/open?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    rdns: 'com.coinbase.wallet',
    installUrl: 'https://www.coinbase.com/wallet/downloads',
    getMobileLink: (url) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
  },
  {
    id: 'trust',
    name: 'Trust Wallet',
    installUrl: 'https://trustwallet.com/download',
    getMobileLink: (url) =>
      `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(url)}`,
  },
];

export function getDappUrl(): string {
  if (typeof window === 'undefined') return 'https://nexusu.app';
  return window.location.href;
}
import type { EIP1193Provider } from 'viem';

export interface DiscoveredWallet {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
  provider: EIP1193Provider;
}

type EIP6963ProviderDetail = {
  info: {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
  };
  provider: EIP1193Provider;
};

const DISCOVERY_TIMEOUT_MS = 400;

export async function discoverInjectedWallets(): Promise<DiscoveredWallet[]> {
  if (typeof window === 'undefined') return [];

  const providers = new Map<string, EIP6963ProviderDetail>();

  const onAnnounce = ((event: CustomEvent<EIP6963ProviderDetail>) => {
    providers.set(event.detail.info.uuid, event.detail);
  }) as EventListener;

  window.addEventListener('eip6963:announceProvider', onAnnounce);
  window.dispatchEvent(new Event('eip6963:requestProvider'));

  await new Promise((resolve) => window.setTimeout(resolve, DISCOVERY_TIMEOUT_MS));
  window.removeEventListener('eip6963:announceProvider', onAnnounce);

  const discovered = [...providers.values()].map((detail) => ({
    uuid: detail.info.uuid,
    name: detail.info.name,
    icon: detail.info.icon,
    rdns: detail.info.rdns,
    provider: detail.provider,
  }));

  if (discovered.length === 0) {
    const fallback = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
    if (fallback) {
      discovered.push({
        uuid: 'injected-fallback',
        name: 'Browser Wallet',
        icon: '',
        rdns: 'injected',
        provider: fallback,
      });
    }
  }

  return discovered;
}
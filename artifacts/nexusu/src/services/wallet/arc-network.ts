import type { EIP1193Provider } from 'viem';
import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_WALLET_PARAMS,
} from '@/config/arc';

type EthereumProvider = EIP1193Provider & {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export function getInjectedProvider(): EthereumProvider | null {
  if (typeof window === 'undefined') return null;
  const eth = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  return eth ?? null;
}

export function hasInjectedWallet(): boolean {
  return getInjectedProvider() !== null;
}

export async function ensureArcTestnet(provider: EthereumProvider): Promise<void> {
  const chainIdHex = `0x${ARC_TESTNET_CHAIN_ID.toString(16)}`;

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (switchError) {
    const err = switchError as { code?: number };
    if (err.code === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [ARC_TESTNET_WALLET_PARAMS],
      });
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
      return;
    }
    throw switchError;
  }
}
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import type { EIP1193Provider } from 'viem';
import { ARC_TESTNET_CHAIN_ID } from '@/config/arc';
import { hasWalletConnectProjectId } from '@/config/wagmi';
import { isMobileBrowser, isWalletInAppBrowser } from '@/lib/device';
import type { DiscoveredWallet } from '@/lib/wallet-discovery';
import type { NexusuIdentity } from '@/services/wallet';
import {
  mapEvmAddress,
  clearAllSessions,
  saveIdentity,
  clearIdentity,
} from '@/services/wallet';
import {
  ensureArcTestnet,
  getInjectedProvider,
  hasInjectedWallet,
} from '@/services/wallet/arc-network';

export interface WalletState {
  isConnected: boolean;
  isConnecting: boolean;
  isWalletLocked: boolean;
  identity: NexusuIdentity | null;
  error: string | null;
}

export interface UseWallet extends WalletState {
  connect: () => Promise<void>;
  connectViaExtension: () => Promise<void>;
  connectViaPopup: () => Promise<void>;
  connectWithWallet: (wallet: DiscoveredWallet) => Promise<void>;
  connectWithProvider: (provider: EIP1193Provider, name?: string) => Promise<void>;
  /** Circle user-controlled wallet: email OTP → PIN → Arc SCA */
  connectWithEmail: (email: string) => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  isAutoConnecting: boolean;
  extensionInstalled: boolean;
  walletConnectEnabled: boolean;
  /** True when VITE_CIRCLE_UC_APP_ID is set (email login available). */
  circleEmailEnabled: boolean;
  /** Last email used for Circle OTP login (localStorage). */
  lastUcEmail: string | null;
  isMobileBrowser: boolean;
  isWalletInAppBrowser: boolean;
  walletAddress: string | null;
  publicKey: string | null;
  session: string | null;
  chainId: number | null;
  isOnArcTestnet: boolean;
  /** True when the active session is a Circle email/PIN wallet. */
  isCircleEmailWallet: boolean;
}

function formatConnectError(err: unknown): string {
  const message = err instanceof Error ? err.message : 'Connection failed. Please try again.';
  if (/rejected|denied|cancel/i.test(message)) {
    return 'Connection request was rejected.';
  }
  return message;
}

export function useWalletConnection(openModal?: () => Promise<void>): UseWallet {
  const { address, isConnected, isConnecting, isReconnecting, chainId } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const [error, setError] = useState<string | null>(null);

  const identity = useMemo<NexusuIdentity | null>(() => {
    if (!address) return null;
    return mapEvmAddress(address);
  }, [address]);

  useEffect(() => {
    if (isConnected && address) {
      saveIdentity({ walletAddress: address, connectedAt: Date.now() });
    } else if (!isConnected && !isReconnecting) {
      clearIdentity();
    }
  }, [isConnected, address, isReconnecting]);

  const connectWithProvider = useCallback(
    async (provider: EIP1193Provider, name = 'Wallet') => {
      setError(null);
      try {
        const connector = injected({
          target: () => ({
            id: `injected-${name.toLowerCase().replace(/\s+/g, '-')}`,
            name,
            provider,
          }),
        });

        await connectAsync({ connector, chainId: ARC_TESTNET_CHAIN_ID });
        await ensureArcTestnet(provider as Parameters<typeof ensureArcTestnet>[0]);
      } catch (err) {
        setError(formatConnectError(err));
      }
    },
    [connectAsync],
  );

  const connectInjected = useCallback(async () => {
    setError(null);
    const provider = getInjectedProvider();
    if (!provider) {
      setError('No wallet detected. Choose a wallet below or install one.');
      return;
    }

    const injectedConnector =
      connectors.find((c) => c.id === 'injected' || c.type === 'injected') ?? connectors[0];
    if (!injectedConnector) {
      setError('No wallet connector available.');
      return;
    }

    try {
      await connectAsync({ connector: injectedConnector, chainId: ARC_TESTNET_CHAIN_ID });
      await ensureArcTestnet(provider);
    } catch (err) {
      setError(formatConnectError(err));
    }
  }, [connectAsync, connectors]);

  const connectWithWallet = useCallback(
    async (wallet: DiscoveredWallet) => {
      await connectWithProvider(wallet.provider, wallet.name);
    },
    [connectWithProvider],
  );

  const connect = useCallback(async () => {
    setError(null);

    if (openModal) {
      try {
        await openModal();
      } catch (err) {
        setError(formatConnectError(err));
      }
      return;
    }

    if (isWalletInAppBrowser()) {
      await connectInjected();
      return;
    }

    await connectInjected();
  }, [openModal, connectInjected]);

  const disconnect = useCallback(async () => {
    setError(null);
    try {
      await disconnectAsync();
    } catch {
      // proceed with local cleanup regardless
    }
    clearAllSessions();
  }, [disconnectAsync]);

  return useMemo<UseWallet>(
    () => ({
      isConnected,
      isConnecting: isConnecting || isReconnecting,
      isWalletLocked: false,
      identity,
      error,
      connect,
      connectViaExtension: connectInjected,
      connectViaPopup: connect,
      connectWithWallet,
      connectWithProvider,
      connectWithEmail: async () => {
        throw new Error('Circle email wallet is provided by WalletContextBridge');
      },
      disconnect,
      reconnect: connect,
      isAutoConnecting: isReconnecting,
      extensionInstalled: hasInjectedWallet(),
      walletConnectEnabled: hasWalletConnectProjectId(),
      circleEmailEnabled: false,
      lastUcEmail: null,
      isMobileBrowser: isMobileBrowser(),
      isWalletInAppBrowser: isWalletInAppBrowser(),
      walletAddress: address ?? null,
      publicKey: null,
      session: null,
      chainId: chainId ?? null,
      isOnArcTestnet: chainId === ARC_TESTNET_CHAIN_ID,
      isCircleEmailWallet: false,
    }),
    [
      isConnected,
      isConnecting,
      isReconnecting,
      identity,
      error,
      connect,
      connectInjected,
      connectWithWallet,
      connectWithProvider,
      disconnect,
      address,
      chainId,
    ],
  );
}
/**
 * useUnicityWallet — primary hook for Sphere wallet auth in Nexusu.
 *
 * Implements the official 3-path transport detection pattern from
 * @unicitylabs/sphere-sdk:
 *   P1: embedded iframe → PostMessageTransport to parent
 *   P2: extension installed → ExtensionTransport
 *   P3: standalone page → PostMessageTransport to popup
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { ConnectClient } from '@unicitylabs/sphere-sdk/connect';
import type { PermissionScope, RpcMethod, IntentAction } from '@unicitylabs/sphere-sdk/connect';
import type { ConnectTransport, PublicIdentity } from '@unicitylabs/sphere-sdk/connect';
import { isInIframe, hasExtension } from '@/lib/detection';
import {
  buildClient,
  createExtensionTransport,
  createIframeTransport,
  createPopupTransport,
  openWalletPopup,
  waitForHostReady,
  WALLET_EVENTS,
} from '@/services/unicity/wallet';
import {
  mapIdentity,
  savePopupSessionId,
  loadPopupSessionId,
  clearAllSessions,
  saveIdentity,
  clearIdentity,
  hasPopupSession,
} from '@/services/unicity';
import type { NexusuIdentity } from '@/services/unicity';

// ── State types ────────────────────────────────────────────────────────────────

export interface WalletState {
  isConnected: boolean;
  isConnecting: boolean;
  isWalletLocked: boolean;
  rawIdentity: PublicIdentity | null;
  identity: NexusuIdentity | null;
  permissions: readonly PermissionScope[];
  error: string | null;
}

export interface UseUnicityWallet extends WalletState {
  /** Connect using the best available transport (auto-detect). */
  connect: () => Promise<void>;
  /** Connect explicitly through the browser extension. */
  connectViaExtension: () => Promise<void>;
  /** Connect by opening the Sphere popup window. */
  connectViaPopup: () => Promise<void>;
  /** Disconnect and clear all session state. */
  disconnect: () => Promise<void>;
  /** Try to reconnect using any persisted session. */
  reconnect: () => Promise<void>;
  /** Execute a read-only wallet query (e.g. sphere_getIdentity). */
  query: <T = unknown>(method: RpcMethod | string, params?: Record<string, unknown>) => Promise<T>;
  /** Trigger a wallet intent that requires user approval (e.g. sign_message). */
  intent: <T = unknown>(action: IntentAction | string, params: Record<string, unknown>) => Promise<T>;
  /** Subscribe to real-time wallet events. Returns an unsubscribe function. */
  on: (event: string, handler: (data: unknown) => void) => () => void;
  /** True during the initial silent auto-connect (hides flash of Connect button). */
  isAutoConnecting: boolean;
  /** True when the Sphere browser extension is installed. */
  extensionInstalled: boolean;
  /** Friendly wallet address (direct address or pubkey). */
  walletAddress: string | null;
  /** 33-byte compressed public key. */
  publicKey: string | null;
  /** Authenticated session ID (popup mode only). */
  session: string | null;
}

const DISCONNECTED: WalletState = {
  isConnected: false,
  isConnecting: false,
  isWalletLocked: false,
  rawIdentity: null,
  identity: null,
  permissions: [],
  error: null,
};

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useUnicityWallet(): UseUnicityWallet {
  const willSilentCheck = isInIframe() || hasExtension() || hasPopupSession();
  const [isAutoConnecting, setIsAutoConnecting] = useState(willSilentCheck);
  const [state, setState] = useState<WalletState>(DISCONNECTED);
  const [sessionId, setSessionId] = useState<string | null>(loadPopupSessionId());

  const clientRef = useRef<ConnectClient | null>(null);
  const transportRef = useRef<ConnectTransport | null>(null);
  const popupRef = useRef<Window | null>(null);
  const popupMode = useRef(false);

  // ── Internal helpers ─────────────────────────────────────────────────────────

  const applyConnected = useCallback(
    (result: { sessionId: string; identity: PublicIdentity; permissions: readonly PermissionScope[] }) => {
      const mapped = mapIdentity(result.identity);
      saveIdentity({
        walletAddress: mapped.walletAddress,
        publicKey: mapped.publicKey,
        nametag: mapped.nametag,
        connectedAt: Date.now(),
      });
      setSessionId(result.sessionId);
      setState({
        ...DISCONNECTED,
        isConnected: true,
        rawIdentity: result.identity,
        identity: mapped,
        permissions: result.permissions,
      });
    },
    [],
  );

  const fullyDisconnect = useCallback(() => {
    transportRef.current?.destroy();
    clientRef.current = null;
    transportRef.current = null;
    popupRef.current?.close();
    popupRef.current = null;
    popupMode.current = false;
    clearAllSessions();
    clearIdentity();
    setSessionId(null);
    setState(DISCONNECTED);
  }, []);

  const ensureClient = useCallback(async (): Promise<ConnectClient> => {
    if (clientRef.current && (!popupMode.current || (popupRef.current && !popupRef.current.closed))) {
      return clientRef.current;
    }
    if (popupMode.current && (!popupRef.current || popupRef.current.closed)) {
      fullyDisconnect();
      throw new Error('Your wallet was closed. Please reconnect to continue.');
    }
    throw new Error('Not connected to wallet.');
  }, [fullyDisconnect]);

  const handleTransportError = useCallback(
    (err: unknown): never => {
      const msg = err instanceof Error ? err.message : String(err);
      if (/not.connected|timeout|transport|closed|session|destroyed/i.test(msg)) {
        fullyDisconnect();
      }
      throw err;
    },
    [fullyDisconnect],
  );

  // ── Extension connect ────────────────────────────────────────────────────────

  const connectViaExtension = useCallback(async () => {
    setState((s) => ({ ...s, isConnecting: true, error: null }));
    try {
      popupMode.current = false;
      const transport = createExtensionTransport();
      transportRef.current = transport;
      const client = buildClient(transport);
      clientRef.current = client;
      const result = await client.connect();
      applyConnected(result);
    } catch (err) {
      setState((s) => ({
        ...s,
        isConnecting: false,
        error: err instanceof Error ? err.message : 'Connection failed. Please try again.',
      }));
    }
  }, [applyConnected]);

  // ── Popup connect ────────────────────────────────────────────────────────────

  const connectViaPopup = useCallback(async () => {
    setState((s) => ({ ...s, isConnecting: true, error: null }));
    try {
      if (isInIframe()) {
        // P1: inside Sphere iframe — talk to parent via PostMessage
        popupMode.current = false;
        const transport = createIframeTransport();
        transportRef.current = transport;
        const client = buildClient(transport);
        clientRef.current = client;
        const result = await client.connect();
        applyConnected(result);
      } else {
        // P3: open Sphere as popup
        popupMode.current = true;
        const popup = openWalletPopup(popupRef.current);
        popupRef.current = popup;

        transportRef.current?.destroy();
        const transport = createPopupTransport(popup);
        transportRef.current = transport;

        await waitForHostReady();

        const savedSessionId = loadPopupSessionId() ?? undefined;
        const client = buildClient(transport, { resumeSessionId: savedSessionId });
        clientRef.current = client;

        const result = await client.connect();
        savePopupSessionId(result.sessionId);
        applyConnected(result);
      }
    } catch (err) {
      setState((s) => ({
        ...s,
        isConnecting: false,
        error: err instanceof Error ? err.message : 'Connection failed. Please try again.',
      }));
    }
  }, [applyConnected]);

  // ── Auto-detect connect ──────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, isConnecting: true, error: null }));
    if (isInIframe()) {
      await connectViaPopup(); // reuses iframe path
    } else if (hasExtension()) {
      await connectViaExtension();
    } else {
      await connectViaPopup();
    }
  }, [connectViaExtension, connectViaPopup]);

  // ── Disconnect ───────────────────────────────────────────────────────────────

  const disconnect = useCallback(async () => {
    try {
      await clientRef.current?.disconnect();
    } catch {
      // ignore — we disconnect regardless
    }
    fullyDisconnect();
  }, [fullyDisconnect]);

  // ── Reconnect ────────────────────────────────────────────────────────────────

  const reconnect = useCallback(async () => {
    await connect();
  }, [connect]);

  // ── Query / Intent / On ──────────────────────────────────────────────────────

  const query = useCallback(
    async <T = unknown>(method: RpcMethod | string, params?: Record<string, unknown>): Promise<T> => {
      const client = await ensureClient();
      try {
        return await client.query<T>(method, params);
      } catch (err) {
        return handleTransportError(err) as never;
      }
    },
    [ensureClient, handleTransportError],
  );

  const intent = useCallback(
    async <T = unknown>(action: IntentAction | string, params: Record<string, unknown>): Promise<T> => {
      const client = await ensureClient();
      try {
        return await client.intent<T>(action, params);
      } catch (err) {
        return handleTransportError(err) as never;
      }
    },
    [ensureClient, handleTransportError],
  );

  const on = useCallback(
    (event: string, handler: (data: unknown) => void): (() => void) => {
      if (!clientRef.current) throw new Error('Not connected to wallet.');
      return clientRef.current.on(event, handler);
    },
    [],
  );

  // ── Popup close polling ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!state.isConnected || !popupMode.current) return;
    const interval = setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        clearInterval(interval);
        fullyDisconnect();
      }
    }, 1_000);
    return () => clearInterval(interval);
  }, [state.isConnected, fullyDisconnect]);

  // ── Wallet events (auto-pushed, no sphere_subscribe needed) ─────────────────

  useEffect(() => {
    if (!state.isConnected || !clientRef.current) return;
    const client = clientRef.current;

    const unsubLocked = client.on(WALLET_EVENTS.LOCKED, () => {
      if (popupMode.current) {
        fullyDisconnect();
      } else {
        setState((s) => ({ ...s, isWalletLocked: true }));
      }
    });

    const unsubIdentity = client.on(WALLET_EVENTS.IDENTITY_CHANGED, (data) => {
      const mapped = mapIdentity(data as PublicIdentity);
      saveIdentity({
        walletAddress: mapped.walletAddress,
        publicKey: mapped.publicKey,
        nametag: mapped.nametag,
        connectedAt: Date.now(),
      });
      setState((s) => ({ ...s, isWalletLocked: false, rawIdentity: data as PublicIdentity, identity: mapped }));
    });

    return () => {
      unsubLocked();
      unsubIdentity();
    };
  }, [state.isConnected, fullyDisconnect]);

  // ── Mount: silent auto-connect ───────────────────────────────────────────────

  useEffect(() => {
    const doSilentCheck = async () => {
      try {
        if (isInIframe()) {
          // P1: iframe — wait for Sphere parent to signal ready
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
              window.removeEventListener('message', onReady);
              reject(new Error('Host not ready'));
            }, 5_000);
            function onReady(e: MessageEvent) {
              const { HOST_READY_TYPE } = e.data ?? {};
              if (HOST_READY_TYPE || e.data?.type === 'SPHERE_HOST_READY') {
                clearTimeout(timer);
                window.removeEventListener('message', onReady);
                resolve();
              }
            }
            window.addEventListener('message', onReady);
          });
          popupMode.current = false;
          const transport = createIframeTransport();
          transportRef.current = transport;
          const client = buildClient(transport, { silent: true });
          clientRef.current = client;
          const result = await client.connect();
          applyConnected(result);
        } else if (hasExtension()) {
          // P2: extension — silent check if origin already approved
          popupMode.current = false;
          const transport = createExtensionTransport();
          transportRef.current = transport;
          const client = buildClient(transport, { silent: true });
          clientRef.current = client;
          const result = await client.connect();
          applyConnected(result);
        } else {
          // P3: try popup session resume
          const savedSessionId = loadPopupSessionId();
          if (!savedSessionId) return;
          popupMode.current = true;
          const popup = openWalletPopup(null);
          popupRef.current = popup;

          transportRef.current?.destroy();
          const transport = createPopupTransport(popup);
          transportRef.current = transport;

          await waitForHostReady(5_000);

          const client = buildClient(transport, { resumeSessionId: savedSessionId, silent: true });
          clientRef.current = client;
          const result = await client.connect();
          savePopupSessionId(result.sessionId);
          applyConnected(result);
        }
      } catch {
        // Silent failure — show Connect button, no error surfaced
        transportRef.current?.destroy();
        clientRef.current = null;
        transportRef.current = null;
        if (popupMode.current) {
          popupRef.current?.close();
          popupRef.current = null;
          popupMode.current = false;
          clearAllSessions();
        }
      }
    };

    doSilentCheck().finally(() => setIsAutoConnecting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...state,
    connect,
    connectViaExtension,
    connectViaPopup,
    disconnect,
    reconnect,
    query,
    intent,
    on,
    isAutoConnecting,
    extensionInstalled: hasExtension(),
    walletAddress: state.identity?.walletAddress ?? null,
    publicKey: state.identity?.publicKey ?? null,
    session: sessionId,
  };
}

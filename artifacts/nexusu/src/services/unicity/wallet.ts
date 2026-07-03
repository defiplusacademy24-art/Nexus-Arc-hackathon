/**
 * Low-level Sphere wallet connection primitives for Nexusu.
 * Wraps @unicitylabs/sphere-sdk/connect — do not import SDK types outside this module.
 */

import {
  ConnectClient,
  HOST_READY_TYPE,
  HOST_READY_TIMEOUT,
  SPHERE_NETWORKS,
  WALLET_EVENTS,
} from '@unicitylabs/sphere-sdk/connect';
import {
  ExtensionTransport,
  PostMessageTransport,
} from '@unicitylabs/sphere-sdk/connect/browser';
import type {
  ConnectTransport,
  PublicIdentity,
  PermissionScope,
  RpcMethod,
  IntentAction,
} from '@unicitylabs/sphere-sdk/connect';

export type { PublicIdentity, PermissionScope, RpcMethod, IntentAction };
export { WALLET_EVENTS };

export const WALLET_URL = 'https://sphere.unicity.network';
export const WALLET_INSTALL_URL = 'https://sphere.unicity.network/home';
export const WALLET_EXTENSION_URL =
  'https://chromewebstore.google.com/search/sphere%20wallet%20unicity';

export const NEXUSU_DAPP = {
  name: 'Nexusu',
  description: 'The Autonomous Community Banking Network',
  url: typeof location !== 'undefined' ? location.origin : 'https://nexusu.app',
} as const;

export interface ConnectResult {
  sessionId: string;
  identity: PublicIdentity;
  permissions: readonly PermissionScope[];
}

/** Wait for the wallet popup / iframe host to signal it is ready. */
export function waitForHostReady(timeoutMs = HOST_READY_TIMEOUT): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('Wallet did not become ready in time. Please try again.'));
    }, timeoutMs);

    function handler(event: MessageEvent) {
      if (event.data?.type === HOST_READY_TYPE) {
        clearTimeout(timer);
        window.removeEventListener('message', handler);
        resolve();
      }
    }
    window.addEventListener('message', handler);
  });
}

/** Build a ConnectClient from an already-created transport. */
export function buildClient(
  transport: ConnectTransport,
  opts: { resumeSessionId?: string; silent?: boolean } = {},
): ConnectClient {
  return new ConnectClient({
    transport,
    dapp: NEXUSU_DAPP,
    network: SPHERE_NETWORKS.testnet2,
    ...opts,
  });
}

// ── Transport factories ────────────────────────────────────────────────────────

export function createExtensionTransport(): ConnectTransport {
  return ExtensionTransport.forClient();
}

export function createIframeTransport(): ConnectTransport {
  return PostMessageTransport.forClient();
}

export function createPopupTransport(
  popup: Window,
): ConnectTransport {
  return PostMessageTransport.forClient({
    target: popup,
    targetOrigin: WALLET_URL,
  });
}

/** Open (or reuse) the Sphere popup window. */
export function openWalletPopup(existingPopup: Window | null): Window {
  if (existingPopup && !existingPopup.closed) {
    existingPopup.focus();
    return existingPopup;
  }
  const popup = window.open(
    `${WALLET_URL}/connect?origin=${encodeURIComponent(location.origin)}`,
    'nexusu-sphere-wallet',
    'width=420,height=650',
  );
  if (!popup) {
    throw new Error(
      'Popup was blocked. Please allow popups for this site and try again.',
    );
  }
  return popup;
}

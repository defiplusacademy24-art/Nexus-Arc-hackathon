/**
 * In-process pub/sub for real-time notification delivery (SSE).
 */

import type { StoredNotification } from "./store";

export type NotificationEvent = {
  kind: "notification";
  notification: StoredNotification;
};

type Listener = (event: NotificationEvent) => void;

const walletListeners = new Map<string, Set<Listener>>();

function key(wallet: string): string {
  return wallet.toLowerCase();
}

export function subscribe(wallet: string, listener: Listener): () => void {
  const k = key(wallet);
  let set = walletListeners.get(k);
  if (!set) {
    set = new Set();
    walletListeners.set(k, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) walletListeners.delete(k);
  };
}

export function publishNotification(notification: StoredNotification): void {
  const set = walletListeners.get(key(notification.recipientWallet));
  if (!set || set.size === 0) return;
  const event: NotificationEvent = { kind: "notification", notification };
  for (const listener of set) {
    try {
      listener(event);
    } catch {
      // ignore listener errors
    }
  }
}

export function publishMany(notifications: StoredNotification[]): void {
  for (const n of notifications) publishNotification(n);
}

/**
 * Real-time notifications: REST load + SSE updates + mark-read actions.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '@/providers/WalletProvider';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotificationStream,
  type ApiNotification,
} from '@/services/notifications/api';

export function useNotifications() {
  const { walletAddress, isConnected } = useWallet();
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const walletRef = useRef(walletAddress);

  walletRef.current = walletAddress;

  const refresh = useCallback(async () => {
    const wallet = walletRef.current;
    if (!wallet) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNotifications(wallet, { limit: 100 });
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial + wallet change load
  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setNotifications([]);
      setUnreadCount(0);
      setLive(false);
      return;
    }
    void refresh();
  }, [isConnected, walletAddress, refresh]);

  // SSE stream
  useEffect(() => {
    if (!isConnected || !walletAddress) return;

    const unsub = subscribeNotificationStream(walletAddress, {
      onConnected: () => setLive(true),
      onNotification: (n) => {
        setNotifications((prev) => {
          if (prev.some((p) => p.id === n.id)) return prev;
          return [n, ...prev];
        });
      },
      onUnread: (count) => setUnreadCount(count),
      onError: () => setLive(false),
    });

    // Fallback poll every 30s in case SSE drops
    const poll = setInterval(() => {
      void refresh();
    }, 30_000);

    return () => {
      unsub();
      clearInterval(poll);
      setLive(false);
    };
  }, [isConnected, walletAddress, refresh]);

  const markRead = useCallback(async (id: string) => {
    const wallet = walletRef.current;
    if (!wallet) return;
    // Optimistic
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      const res = await markNotificationRead(wallet, id);
      setUnreadCount(res.unreadCount);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? res.notification : n)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark read');
      void refresh();
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    const wallet = walletRef.current;
    if (!wallet) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead(wallet);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark all read');
      void refresh();
    }
  }, [refresh]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    live,
    refresh,
    markRead,
    markAllRead,
    isReady: Boolean(isConnected && walletAddress),
  };
}

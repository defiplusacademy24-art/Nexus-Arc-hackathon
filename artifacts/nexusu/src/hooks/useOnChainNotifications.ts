/**
 * Polls the API to sync Arc on-chain USDC activity into notifications.
 * Scanning runs server-side (Arcscan) to avoid browser CORS.
 */

import { useEffect, useRef, useState } from 'react';
import { useWallet } from '@/providers/WalletProvider';

const POLL_MS = 15_000;

async function syncOnchain(wallet: string): Promise<{ created: number; scanned: number }> {
  const res = await fetch('/api/onchain/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-wallet-address': wallet,
    },
    body: '{}',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return (await res.json()) as { created: number; scanned: number };
}

export function useOnChainNotifications() {
  const { walletAddress, isConnected } = useWallet();
  const [lastScanAt, setLastScanAt] = useState<Date | null>(null);
  const [lastCreated, setLastCreated] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    if (!isConnected || !walletAddress) return;

    let cancelled = false;

    const scan = async () => {
      if (busy.current || cancelled) return;
      busy.current = true;
      setScanning(true);
      setError(null);
      try {
        const { created, scanned } = await syncOnchain(walletAddress);
        if (!cancelled) {
          setLastCreated(created);
          setLastScanAt(new Date());
          if (created > 0) {
            console.info(
              `[Nexusu] Synced ${scanned} Arc transfer(s); ${created} new notification(s)`,
            );
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'On-chain sync failed');
          console.warn('[Nexusu] On-chain sync failed:', e);
        }
      } finally {
        busy.current = false;
        if (!cancelled) setScanning(false);
      }
    };

    // Immediate sync so existing transfers (e.g. 2 USDC already sent) show up
    void scan();
    const id = setInterval(() => void scan(), POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isConnected, walletAddress]);

  return { lastScanAt, lastCreated, error, scanning };
}

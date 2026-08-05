/**
 * useProfile — editable profile preferences.
 * localStorage for instant UI; API (/api/profile) for cross-device sync
 * when DATABASE_URL / Vercel Postgres is enabled.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  loadProfilePrefs,
  saveProfilePrefs,
  fetchProfileFromServer,
  syncProfileToServer,
  PROFILE_UPDATED_EVENT,
  type ProfilePrefs,
  type AvatarColor,
  type NotificationPrefs,
} from '@/services/profile';
import { useWallet } from '@/providers/WalletProvider';

export interface UseProfileState {
  prefs: ProfilePrefs;
  isDirty: boolean;
  syncing: boolean;
  syncError: string | null;
  update: <K extends keyof ProfilePrefs>(key: K, value: ProfilePrefs[K]) => void;
  save: () => void;
  reset: () => void;
  setAvatarColor: (color: AvatarColor) => void;
  setAvatarUrl: (url: string) => void;
  clearAvatar: () => void;
  setNotifPref: (key: keyof NotificationPrefs, value: boolean) => void;
}

export function useProfile(): UseProfileState {
  const { walletAddress } = useWallet();
  const wallet = walletAddress ?? '';
  const [prefs, setPrefs] = useState<ProfilePrefs>(() => loadProfilePrefs());
  const [isDirty, setIsDirty] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const loadedFor = useRef<string>('');

  // Pull server profile when wallet connects (cross-device username)
  useEffect(() => {
    if (!wallet) return;
    if (loadedFor.current === wallet.toLowerCase()) return;
    loadedFor.current = wallet.toLowerCase();
    let cancelled = false;
    (async () => {
      setSyncing(true);
      setSyncError(null);
      const remote = await fetchProfileFromServer(wallet);
      if (cancelled) return;
      if (remote) {
        setPrefs(remote);
        setIsDirty(false);
      }
      setSyncing(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  // Stay in sync when avatar is updated from another component
  useEffect(() => {
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<ProfilePrefs>).detail;
      if (detail) {
        setPrefs(detail);
        setIsDirty(false);
      } else {
        setPrefs(loadProfilePrefs());
      }
    };
    window.addEventListener(PROFILE_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, onUpdate);
  }, []);

  const persist = useCallback(
    async (next: ProfilePrefs) => {
      if (wallet) {
        setSyncing(true);
        setSyncError(null);
        const result = await syncProfileToServer(wallet, next);
        setSyncing(false);
        if (!result.ok) {
          setSyncError(result.error ?? 'Could not sync profile');
          // Still keep local cache so this device works offline
          saveProfilePrefs(next);
        }
      } else {
        saveProfilePrefs(next);
      }
      setIsDirty(false);
    },
    [wallet],
  );

  const update = useCallback(<K extends keyof ProfilePrefs>(key: K, value: ProfilePrefs[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    setIsDirty(true);
  }, []);

  const setNotifPref = useCallback((key: keyof NotificationPrefs, value: boolean) => {
    setPrefs((p) => ({
      ...p,
      notifPrefs: { ...p.notifPrefs, [key]: value },
    }));
    setIsDirty(true);
  }, []);

  const setAvatarColor = useCallback((color: AvatarColor) => {
    update('avatarColor', color);
  }, [update]);

  /** Immediately persist avatar photo (local + server). */
  const setAvatarUrl = useCallback(
    (url: string) => {
      setPrefs((p) => {
        const next = { ...p, avatarUrl: url };
        void persist(next);
        return next;
      });
      setIsDirty(false);
    },
    [persist],
  );

  const clearAvatar = useCallback(() => {
    setAvatarUrl('');
  }, [setAvatarUrl]);

  const save = useCallback(() => {
    const next = {
      ...prefs,
      displayNameOverride: prefs.displayNameOverride.trim(),
    };
    setPrefs(next);
    void persist(next);
  }, [prefs, persist]);

  const reset = useCallback(() => {
    setPrefs(loadProfilePrefs());
    setIsDirty(false);
  }, []);

  return {
    prefs,
    isDirty,
    syncing,
    syncError,
    update,
    save,
    reset,
    setAvatarColor,
    setAvatarUrl,
    clearAvatar,
    setNotifPref,
  };
}

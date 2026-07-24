/**
 * useProfile — manages editable profile preferences stored in localStorage.
 * Separate from wallet identity which is immutable and controlled by the SDK.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  loadProfilePrefs,
  saveProfilePrefs,
  PROFILE_UPDATED_EVENT,
  type ProfilePrefs,
  type AvatarColor,
  type NotificationPrefs,
} from '@/services/profile';

export interface UseProfileState {
  prefs: ProfilePrefs;
  isDirty: boolean;
  update: <K extends keyof ProfilePrefs>(key: K, value: ProfilePrefs[K]) => void;
  save: () => void;
  reset: () => void;
  setAvatarColor: (color: AvatarColor) => void;
  setAvatarUrl: (url: string) => void;
  clearAvatar: () => void;
  setNotifPref: (key: keyof NotificationPrefs, value: boolean) => void;
}

export function useProfile(): UseProfileState {
  const [prefs, setPrefs] = useState<ProfilePrefs>(() => loadProfilePrefs());
  const [isDirty, setIsDirty] = useState(false);

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

  /** Immediately persist avatar photo (used across header/nav). */
  const setAvatarUrl = useCallback((url: string) => {
    setPrefs((p) => {
      const next = { ...p, avatarUrl: url };
      saveProfilePrefs(next);
      return next;
    });
    setIsDirty(false);
  }, []);

  const clearAvatar = useCallback(() => {
    setAvatarUrl('');
  }, [setAvatarUrl]);

  const save = useCallback(() => {
    saveProfilePrefs(prefs);
    setIsDirty(false);
  }, [prefs]);

  const reset = useCallback(() => {
    setPrefs(loadProfilePrefs());
    setIsDirty(false);
  }, []);

  return {
    prefs,
    isDirty,
    update,
    save,
    reset,
    setAvatarColor,
    setAvatarUrl,
    clearAvatar,
    setNotifPref,
  };
}

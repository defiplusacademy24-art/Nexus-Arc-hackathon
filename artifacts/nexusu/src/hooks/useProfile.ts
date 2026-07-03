/**
 * useProfile — manages editable profile preferences stored in localStorage.
 * Separate from wallet identity which is immutable and controlled by the SDK.
 */

import { useState, useCallback } from 'react';
import {
  loadProfilePrefs,
  saveProfilePrefs,
  type ProfilePrefs,
  type AvatarColor,
  type NotificationPrefs,
} from '@/services/unicity/profile';

export interface UseProfileState {
  prefs: ProfilePrefs;
  isDirty: boolean;
  update: <K extends keyof ProfilePrefs>(key: K, value: ProfilePrefs[K]) => void;
  save: () => void;
  reset: () => void;
  setAvatarColor: (color: AvatarColor) => void;
  setNotifPref: (key: keyof NotificationPrefs, value: boolean) => void;
}

export function useProfile(): UseProfileState {
  const [prefs, setPrefs] = useState<ProfilePrefs>(() => loadProfilePrefs());
  const [isDirty, setIsDirty] = useState(false);

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

  const save = useCallback(() => {
    saveProfilePrefs(prefs);
    setIsDirty(false);
  }, [prefs]);

  const reset = useCallback(() => {
    setPrefs(loadProfilePrefs());
    setIsDirty(false);
  }, []);

  return { prefs, isDirty, update, save, reset, setAvatarColor, setNotifPref };
}

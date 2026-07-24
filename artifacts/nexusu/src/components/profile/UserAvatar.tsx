/**
 * Shared user avatar — photo if uploaded, else gradient initials.
 * Used in profile header, top nav, and sidebar.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AVATAR_COLORS,
  loadProfilePrefs,
  PROFILE_UPDATED_EVENT,
  type ProfilePrefs,
} from '@/services/profile';

type Size = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<Size, string> = {
  sm: 'w-6 h-6 text-[9px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-20 h-20 text-2xl',
};

function initialsFrom(name: string): string {
  const cleaned = name.replace(/^@/, '').trim();
  if (!cleaned) return 'ME';
  const parts = cleaned.split(/[\s._@-]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

interface UserAvatarProps {
  /** Optional live prefs (profile page). If omitted, reads localStorage. */
  prefs?: ProfilePrefs;
  /** Fallback name for initials */
  displayName?: string;
  size?: Size;
  className?: string;
  rounded?: 'full' | '2xl';
}

export function UserAvatar({
  prefs: prefsProp,
  displayName = '',
  size = 'md',
  className,
  rounded = 'full',
}: UserAvatarProps) {
  const [prefs, setPrefs] = useState<ProfilePrefs>(() => prefsProp ?? loadProfilePrefs());

  useEffect(() => {
    if (prefsProp) setPrefs(prefsProp);
  }, [prefsProp]);

  useEffect(() => {
    if (prefsProp) return; // parent owns updates
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<ProfilePrefs>).detail;
      setPrefs(detail ?? loadProfilePrefs());
    };
    window.addEventListener(PROFILE_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, onUpdate);
  }, [prefsProp]);

  const color = AVATAR_COLORS[prefs.avatarColor] ?? AVATAR_COLORS.sky;
  const name = prefs.displayNameOverride.trim() || displayName;
  const initials = prefs.avatarEmoji || initialsFrom(name);
  const radius = rounded === '2xl' ? 'rounded-2xl' : 'rounded-full';

  if (prefs.avatarUrl) {
    return (
      <img
        src={prefs.avatarUrl}
        alt={name || 'Profile'}
        className={cn(
          SIZE_CLASS[size],
          radius,
          'object-cover flex-shrink-0 bg-stone-100 dark:bg-white/10',
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        SIZE_CLASS[size],
        radius,
        'bg-gradient-to-br flex items-center justify-center flex-shrink-0 font-bold',
        color.bg,
        color.text,
        className,
      )}
      aria-hidden={!name}
    >
      <span className="leading-none">{initials}</span>
    </div>
  );
}

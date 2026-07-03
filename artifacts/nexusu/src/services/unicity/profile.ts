/**
 * Profile preferences for Nexusu.
 *
 * User-editable settings that live alongside wallet identity
 * but are stored locally in localStorage (not in the wallet).
 * These never override the canonical on-chain identity from the SDK.
 */

const PREFS_KEY = 'nexusu-profile-prefs';

export type AvatarColor =
  | 'orange'
  | 'amber'
  | 'emerald'
  | 'sky'
  | 'purple'
  | 'rose'
  | 'slate';

export interface NotificationPrefs {
  contributions: boolean;
  loans: boolean;
  governance: boolean;
  security: boolean;
  aiInsights: boolean;
}

export interface ProfilePrefs {
  displayNameOverride: string;
  avatarColor: AvatarColor;
  avatarEmoji: string;
  language: string;
  timezone: string;
  notifPrefs: NotificationPrefs;
}

const DEFAULT_PREFS: ProfilePrefs = {
  displayNameOverride: '',
  avatarColor: 'orange',
  avatarEmoji: '',
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  notifPrefs: {
    contributions: true,
    loans: true,
    governance: true,
    security: true,
    aiInsights: false,
  },
};

export function loadProfilePrefs(): ProfilePrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<ProfilePrefs>;
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      notifPrefs: {
        ...DEFAULT_PREFS.notifPrefs,
        ...(parsed.notifPrefs ?? {}),
      },
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveProfilePrefs(prefs: ProfilePrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function updateProfilePref<K extends keyof ProfilePrefs>(
  key: K,
  value: ProfilePrefs[K],
): ProfilePrefs {
  const current = loadProfilePrefs();
  const next = { ...current, [key]: value };
  saveProfilePrefs(next);
  return next;
}

export const AVATAR_COLORS: Record<AvatarColor, { bg: string; text: string; label: string }> = {
  orange:  { bg: 'from-[#E8461E] to-[#F97316]', text: 'text-white', label: 'Nexusu' },
  amber:   { bg: 'from-amber-400 to-orange-400', text: 'text-white', label: 'Amber' },
  emerald: { bg: 'from-emerald-500 to-teal-400', text: 'text-white', label: 'Emerald' },
  sky:     { bg: 'from-sky-400 to-blue-500',     text: 'text-white', label: 'Sky' },
  purple:  { bg: 'from-purple-500 to-violet-500', text: 'text-white', label: 'Purple' },
  rose:    { bg: 'from-rose-400 to-pink-500',    text: 'text-white', label: 'Rose' },
  slate:   { bg: 'from-slate-500 to-slate-600',  text: 'text-white', label: 'Slate' },
};

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'ha', label: 'Hausa' },
  { code: 'yo', label: 'Yorùbá' },
  { code: 'am', label: 'አማርኛ (Amharic)' },
  { code: 'pt', label: 'Português' },
  { code: 'ar', label: 'العربية' },
];

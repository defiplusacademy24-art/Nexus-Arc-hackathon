/**
 * Profile preferences for Nexusu.
 *
 * User-editable settings that live alongside wallet identity
 * but are stored locally in localStorage (not in the wallet).
 * These never override the canonical on-chain identity from the SDK.
 */

const PREFS_KEY = 'nexusu-profile-prefs';

/** Fired when profile prefs are saved so nav/header can refresh avatars. */
export const PROFILE_UPDATED_EVENT = 'nexusu:profile-updated';

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
  /** Base64 data URL of uploaded profile photo (or empty). */
  avatarUrl: string;
  language: string;
  timezone: string;
  notifPrefs: NotificationPrefs;
}

const DEFAULT_PREFS: ProfilePrefs = {
  displayNameOverride: '',
  avatarColor: 'sky',
  avatarEmoji: '',
  avatarUrl: '',
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
      avatarUrl: typeof parsed.avatarUrl === 'string' ? parsed.avatarUrl : '',
      notifPrefs: {
        ...DEFAULT_PREFS.notifPrefs,
        ...(parsed.notifPrefs ?? {}),
      },
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function notifyProfileUpdated(prefs?: ProfilePrefs): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(PROFILE_UPDATED_EVENT, { detail: prefs ?? loadProfilePrefs() }),
  );
}

export function saveProfilePrefs(prefs: ProfilePrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  notifyProfileUpdated(prefs);
}

/**
 * Human-friendly name for greetings / UI.
 * Prefers profile override (e.g. "Rita") over wallet identity strings.
 */
export function getPreferredDisplayName(opts?: {
  prefs?: ProfilePrefs | null;
  identityDisplayName?: string | null;
  nametag?: string | null;
  fallback?: string;
}): string {
  const prefs = opts?.prefs ?? loadProfilePrefs();
  const override = prefs.displayNameOverride?.trim();
  if (override) return override;

  const fromIdentity = opts?.identityDisplayName?.trim();
  // Avoid showing raw 0x addresses as a "name"
  if (
    fromIdentity &&
    !/^0x[a-fA-F0-9]{8,}$/.test(fromIdentity) &&
    !fromIdentity.includes('…') &&
    fromIdentity.length < 42
  ) {
    return fromIdentity;
  }

  const tag = opts?.nametag?.trim();
  if (tag) return tag.startsWith('@') ? tag : tag;

  return opts?.fallback ?? 'there';
}

/**
 * Resize an image file to a square JPEG data URL for localStorage avatars.
 * Max edge 256px to stay under storage quotas.
 */
export function fileToAvatarDataUrl(
  file: File,
  maxSize = 256,
  quality = 0.85,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file (PNG, JPG, or WebP).'));
      return;
    }
    // ~4MB source max
    if (file.size > 4 * 1024 * 1024) {
      reject(new Error('Image is too large. Use a file under 4 MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(maxSize, Math.max(img.width, img.height));
        // Center-crop to square
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not process image.'));
          return;
        }
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
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
  orange:  { bg: 'from-[#6393C4] to-[#77A6DB]', text: 'text-white', label: 'Nexusu' },
  amber:   { bg: 'from-[#5289B8] to-[#77A6DB]', text: 'text-white', label: 'Steel' },
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

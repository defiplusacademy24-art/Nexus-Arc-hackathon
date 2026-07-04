/**
 * Invitation utilities — invite code generation, QR link helpers.
 * Future-ready: swap generateInviteCode() for Sphere Messaging when integrated.
 */

/** Short uppercase code like "AAB-XK7-M3P" */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () =>
    Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg()}-${seg()}-${seg()}`;
}

/** Short unique cooperative ID like "ABCDE123" */
export function generateCoopId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/** Full invite link from code */
export function getInviteLink(inviteCode: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://nexusu.app';
  return `${base}/join/${inviteCode}`;
}

/** Normalise a code the user types — trim, uppercase, allow with or without dashes */
export function normaliseCode(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/\s/g, '').replace(/-/g, '');
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 9)}`;
  }
  return raw.toUpperCase().trim();
}

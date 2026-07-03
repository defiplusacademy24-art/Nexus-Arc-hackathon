/**
 * Session persistence for Nexusu ↔ Sphere wallet sessions.
 * Uses sessionStorage so the session lives for the browser tab lifetime.
 * Popup sessions are stored here so reconnection skips the approval modal.
 */

const POPUP_SESSION_KEY = 'nexusu-sphere-popup-session';
const IDENTITY_KEY = 'nexusu-sphere-identity';

export interface StoredIdentity {
  walletAddress: string;
  publicKey: string;
  nametag?: string;
  connectedAt: number;
}

// ── Popup session ──────────────────────────────────────────────────────────────

export function savePopupSessionId(sessionId: string): void {
  sessionStorage.setItem(POPUP_SESSION_KEY, sessionId);
}

export function loadPopupSessionId(): string | null {
  return sessionStorage.getItem(POPUP_SESSION_KEY);
}

export function clearPopupSession(): void {
  sessionStorage.removeItem(POPUP_SESSION_KEY);
}

export function hasPopupSession(): boolean {
  return sessionStorage.getItem(POPUP_SESSION_KEY) !== null;
}

// ── Identity cache ─────────────────────────────────────────────────────────────

export function saveIdentity(identity: StoredIdentity): void {
  sessionStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
}

export function loadIdentity(): StoredIdentity | null {
  const raw = sessionStorage.getItem(IDENTITY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredIdentity;
  } catch {
    return null;
  }
}

export function clearIdentity(): void {
  sessionStorage.removeItem(IDENTITY_KEY);
}

// ── Full clear ─────────────────────────────────────────────────────────────────

export function clearAllSessions(): void {
  clearPopupSession();
  clearIdentity();
}

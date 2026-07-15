const IDENTITY_KEY = 'nexusu-arc-wallet-identity';

export interface StoredIdentity {
  walletAddress: string;
  connectedAt: number;
}

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

export function clearAllSessions(): void {
  clearIdentity();
}
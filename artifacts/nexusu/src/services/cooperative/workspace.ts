/**
 * Workspace (active cooperative) persistence.
 * The active cooperative ID is stored in localStorage and synced to React state
 * via CooperativeProvider.
 */

const ACTIVE_KEY = 'nexusu:active-coop';

export function getActiveCooperativeId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveCooperativeId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function clearActiveCooperativeId(): void {
  localStorage.removeItem(ACTIVE_KEY);
}

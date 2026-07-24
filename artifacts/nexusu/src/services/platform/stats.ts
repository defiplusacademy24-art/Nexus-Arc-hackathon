/**
 * Public platform metrics (landing page — no wallet required).
 */

export interface PlatformStats {
  cooperatives: number;
  activeCooperatives: number;
  members: number;
  agentsRunning: number;
  agentsTotal: number;
  transactions: number;
  storage?: 'postgres' | 'file';
  updatedAt?: string;
}

const EMPTY: PlatformStats = {
  cooperatives: 0,
  activeCooperatives: 0,
  members: 0,
  agentsRunning: 0,
  agentsTotal: 0,
  transactions: 0,
};

export async function fetchPlatformStats(): Promise<PlatformStats> {
  try {
    const res = await fetch('/api/platform/stats', {
      headers: { Accept: 'application/json' },
      // Prefer fresh network numbers over stale browser cache
      cache: 'no-store',
    });
    if (!res.ok) return EMPTY;
    const data = (await res.json()) as Partial<PlatformStats>;
    return {
      cooperatives: Number(data.cooperatives ?? 0) || 0,
      activeCooperatives: Number(data.activeCooperatives ?? 0) || 0,
      members: Number(data.members ?? 0) || 0,
      agentsRunning: Number(data.agentsRunning ?? 0) || 0,
      agentsTotal: Number(data.agentsTotal ?? 0) || 0,
      transactions: Number(data.transactions ?? 0) || 0,
      storage: data.storage,
      updatedAt: data.updatedAt,
    };
  } catch {
    return EMPTY;
  }
}

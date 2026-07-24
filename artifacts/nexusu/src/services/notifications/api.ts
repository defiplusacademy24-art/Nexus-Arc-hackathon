/**
 * Notifications + domain API client (REST + SSE).
 * Uses Vite proxy: /api → api-server :8080
 */

import type { AppNotification, NotifType } from '@/types';

const WALLET_HEADER = 'x-wallet-address';

function headers(wallet: string, json = false): HeadersInit {
  const h: Record<string, string> = {
    [WALLET_HEADER]: wallet,
    Accept: 'application/json',
  };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? res.statusText;
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}

export type ApiNotification = AppNotification & {
  coopId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function fetchNotifications(
  wallet: string,
  opts?: { unreadOnly?: boolean; limit?: number },
): Promise<{ notifications: ApiNotification[]; unreadCount: number }> {
  const params = new URLSearchParams();
  if (opts?.unreadOnly) params.set('unread', 'true');
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  const res = await fetch(`/api/notifications${qs ? `?${qs}` : ''}`, {
    headers: headers(wallet),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as {
    notifications: ApiNotification[];
    unreadCount: number;
  };
  return {
    notifications: (data.notifications ?? []).map(normalizeNotif),
    unreadCount: data.unreadCount ?? 0,
  };
}

export async function fetchUnreadCount(wallet: string): Promise<number> {
  const res = await fetch('/api/notifications/unread-count', {
    headers: headers(wallet),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { count: number };
  return data.count ?? 0;
}

export async function markNotificationRead(
  wallet: string,
  id: string,
): Promise<{ notification: ApiNotification; unreadCount: number }> {
  const res = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
    headers: headers(wallet),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as {
    notification: ApiNotification;
    unreadCount: number;
  };
  return {
    notification: normalizeNotif(data.notification),
    unreadCount: data.unreadCount ?? 0,
  };
}

export async function markAllNotificationsRead(
  wallet: string,
): Promise<{ updated: number; unreadCount: number }> {
  const res = await fetch('/api/notifications/read-all', {
    method: 'POST',
    headers: headers(wallet, true),
    body: '{}',
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as { updated: number; unreadCount: number };
}

/** Open SSE stream for real-time notifications. Returns cleanup fn. */
export function subscribeNotificationStream(
  wallet: string,
  handlers: {
    onNotification?: (n: ApiNotification) => void;
    onUnread?: (count: number) => void;
    onError?: (err: Event) => void;
    onConnected?: () => void;
  },
): () => void {
  const url = `/api/notifications/stream?wallet=${encodeURIComponent(wallet)}`;
  const es = new EventSource(url);

  es.addEventListener('connected', () => {
    handlers.onConnected?.();
  });

  es.addEventListener('notification', (ev) => {
    try {
      const data = JSON.parse((ev as MessageEvent).data) as ApiNotification;
      handlers.onNotification?.(normalizeNotif(data));
    } catch {
      // ignore malformed
    }
  });

  es.addEventListener('unread', (ev) => {
    try {
      const data = JSON.parse((ev as MessageEvent).data) as { count: number };
      handlers.onUnread?.(data.count ?? 0);
    } catch {
      // ignore
    }
  });

  es.onerror = (err) => {
    handlers.onError?.(err);
  };

  return () => {
    es.close();
  };
}

function normalizeNotif(n: ApiNotification): ApiNotification {
  return {
    id: n.id,
    type: (n.type as NotifType) ?? 'ai',
    title: n.title,
    description: n.description,
    timestamp: n.timestamp,
    read: Boolean(n.read),
    actionLabel: n.actionLabel,
    actionHref: n.actionHref,
    coopId: n.coopId,
    metadata: n.metadata,
  };
}

// ── Cooperatives API ───────────────────────────────────────────────────────────

/** List cooperatives for wallet (server is source of truth when DATABASE_URL is set). */
export async function apiListCooperatives(
  wallet: string,
): Promise<{
  cooperatives: Array<Record<string, unknown>>;
  storage?: 'postgres' | 'file';
}> {
  const res = await fetch('/api/cooperatives', {
    headers: headers(wallet),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/**
 * Hydrate cooperatives + members for the connected wallet.
 * Call after login so UI restores durable server data across devices/redeploys.
 */
export async function apiHydrateCooperatives(
  wallet: string,
): Promise<{
  cooperatives: Array<Record<string, unknown>>;
  membersByCoop: Record<string, Array<Record<string, unknown>>>;
  storage?: 'postgres' | 'file';
}> {
  const res = await fetch('/api/cooperatives?hydrate=1', {
    headers: headers(wallet),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiCreateCooperative(
  wallet: string,
  body: Record<string, unknown>,
): Promise<{
  cooperative: { id: string; name: string; inviteCode: string; [k: string]: unknown };
  member?: { id: string; joinPosition?: number; [k: string]: unknown };
  created?: boolean;
  storage?: 'postgres' | 'file';
}> {
  const res = await fetch('/api/cooperatives', {
    method: 'POST',
    headers: headers(wallet, true),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiJoinCooperative(
  wallet: string,
  inviteCode: string,
  opts?: { displayName?: string; email?: string },
): Promise<{
  cooperative: { id: string; name: string; inviteCode: string; [k: string]: unknown };
  member?: { id: string; joinPosition?: number; name?: string; email?: string; [k: string]: unknown };
  joined?: boolean;
  joinPosition?: number;
  message?: string;
}> {
  const res = await fetch('/api/cooperatives/join', {
    method: 'POST',
    headers: headers(wallet, true),
    body: JSON.stringify({
      inviteCode,
      displayName: opts?.displayName,
      email: opts?.email,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiActivateCooperative(
  wallet: string,
  coopId: string,
): Promise<{
  cooperative: { id: string; status: string; [k: string]: unknown };
  message?: string;
}> {
  const res = await fetch(`/api/cooperatives/${encodeURIComponent(coopId)}/activate`, {
    method: 'POST',
    headers: headers(wallet, true),
    body: '{}',
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiCooperativeSummary(
  wallet: string,
  coopId: string,
): Promise<{ summary: Record<string, unknown> }> {
  const res = await fetch(`/api/cooperatives/${encodeURIComponent(coopId)}/summary`, {
    headers: headers(wallet),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiListMembers(
  wallet: string,
  coopId: string,
): Promise<{ members: Array<Record<string, unknown>> }> {
  const res = await fetch(`/api/cooperatives/${encodeURIComponent(coopId)}/members`, {
    headers: headers(wallet),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

// ── Transactions API ───────────────────────────────────────────────────────────

export type TxType = 'deposit' | 'withdrawal' | 'contribution';

export async function apiCreateTransaction(
  wallet: string,
  input: {
    coopId?: string;
    inviteCode?: string;
    type: TxType;
    amount: number;
    note?: string;
  },
): Promise<{
  transaction: {
    id: string;
    type: TxType;
    amount: number;
    createdAt: string;
    [k: string]: unknown;
  };
  snapshot: Record<string, number | string> | null;
  notificationsCreated: number;
}> {
  const res = await fetch('/api/transactions', {
    method: 'POST',
    headers: headers(wallet, true),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiListTransactions(
  wallet: string,
  opts?: { coopId?: string; limit?: number },
): Promise<{
  transactions: Array<{
    id: string;
    coopId: string;
    walletIdentity: string;
    type: TxType;
    amount: number;
    currency: string;
    note?: string;
    createdAt: string;
  }>;
}> {
  const params = new URLSearchParams();
  if (opts?.coopId) params.set('coopId', opts.coopId);
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  const res = await fetch(`/api/transactions${qs ? `?${qs}` : ''}`, {
    headers: headers(wallet),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiTreasurySnapshot(
  wallet: string,
  coopId: string,
): Promise<{ snapshot: Record<string, number | string> }> {
  const res = await fetch(`/api/transactions/treasury/${encodeURIComponent(coopId)}`, {
    headers: headers(wallet),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/** Report on-chain Arc transfers so the backend can emit notifications. */
export async function apiReportOnchainTransfers(
  wallet: string,
  transfers: Array<{
    txHash: string;
    logIndex?: number | null;
    direction: 'in' | 'out';
    amount: number;
    token?: 'usdc-erc20' | 'usdc-native';
    counterparty?: string;
    blockNumber?: number;
    explorerUrl?: string;
    timestamp?: string;
  }>,
): Promise<{ processed: number; created: number }> {
  const res = await fetch('/api/onchain/transfers', {
    method: 'POST',
    headers: headers(wallet, true),
    body: JSON.stringify({ transfers }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

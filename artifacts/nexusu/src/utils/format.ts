/**
 * Shared formatting utilities for Nexusu dashboard.
 */

// ── Currency ───────────────────────────────────────────────────────────────────

export function formatCurrency(
  amount: number,
  currency = 'USD',
  opts?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    ...opts,
  }).format(amount);
}

export function formatCompact(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return formatCurrency(amount);
}

// ── Number ─────────────────────────────────────────────────────────────────────

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatPercent(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

// ── Date / Time ────────────────────────────────────────────────────────────────

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

export function formatTimeAgo(dateStr: string): string {
  return formatRelative(dateStr);
}

// ── Score colours ──────────────────────────────────────────────────────────────

export function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-500';
  if (score >= 60) return 'text-amber-500';
  return 'text-red-500';
}

export function scoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20';
  if (score >= 60) return 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
  return 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20';
}

export function riskLabel(score: number): string {
  if (score <= 30) return 'Low';
  if (score <= 60) return 'Medium';
  return 'High';
}

export function riskColor(score: number): string {
  if (score <= 30) return 'text-emerald-500';
  if (score <= 60) return 'text-amber-500';
  return 'text-red-500';
}

// ── Wallet address ─────────────────────────────────────────────────────────────

export function truncateWallet(address: string, start = 8, end = 6): string {
  if (!address || address.length <= start + end + 3) return address;
  return `${address.slice(0, start)}…${address.slice(-end)}`;
}

// ── Role ───────────────────────────────────────────────────────────────────────

export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    admin: 'Admin',
    treasurer: 'Treasurer',
    secretary: 'Secretary',
    member: 'Member',
  };
  return map[role] ?? role;
}

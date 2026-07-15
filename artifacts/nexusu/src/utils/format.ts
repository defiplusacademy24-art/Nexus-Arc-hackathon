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
  if (score >= 60) return 'text-[#77A6DB]';
  return 'text-red-500';
}

export function scoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20';
  if (score >= 60) return 'bg-[#6393C4]/8 dark:bg-[#6393C4]/10 text-[#5289B8] dark:text-[#77A6DB] border-[#6393C4]/20 dark:border-[#6393C4]/20';
  return 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20';
}

export function riskLabel(score: number): string {
  if (score <= 30) return 'Low';
  if (score <= 60) return 'Medium';
  return 'High';
}

export function riskColor(score: number): string {
  if (score <= 30) return 'text-emerald-500';
  if (score <= 60) return 'text-[#77A6DB]';
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
    founder: 'Founder',
    admin: 'Admin',
    treasurer: 'Treasurer',
    secretary: 'Secretary',
    auditor: 'Auditor',
    member: 'Member',
  };
  return map[role] ?? role;
}

export function roleBadgeClass(role: string): string {
  const map: Record<string, string> = {
    founder:
      'bg-[#6393C4]/10 dark:bg-[#6393C4]/10 text-[#5289B8] dark:text-[#77A6DB] border-[#6393C4]/25 dark:border-[#6393C4]/20',
    admin:
      'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/20',
    treasurer:
      'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/20',
    secretary:
      'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-500/20',
    auditor:
      'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/20',
    member:
      'bg-stone-50 dark:bg-[#2E3B4B]/40 text-stone-600 dark:text-white/50 border-stone-200 dark:border-white/10',
  };
  return (
    map[role] ??
    'bg-stone-50 dark:bg-[#2E3B4B]/40 text-stone-600 dark:text-white/50 border-stone-200 dark:border-white/10'
  );
}

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, UserPlus, Star, Users, Hash } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { useCooperative } from '@/providers/CooperativeProvider';
import { useWallet } from '@/providers/WalletProvider';
import { useNotifications } from '@/hooks/useNotifications';
import {
  loadMembersInPayoutOrder,
  mergeRemoteMemberTotals,
  recomputeContributionsFromTransactions,
} from '@/services/cooperative/members';
import {
  buildCooperativeSummary,
  contributionStatusLabel,
  ROTATION_MODE_LABELS,
} from '@/services/cooperative/rotation';
import { apiListMembers, apiListTransactions } from '@/services/notifications/api';
import { formatCurrency, formatDate, riskColor, riskLabel, roleLabel, truncateWallet } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { Member } from '@/types';

const ROLE_BADGE: Record<string, string> = {
  founder: 'bg-[#6393C4]/10 dark:bg-[#6393C4]/10 text-[#5289B8] dark:text-[#77A6DB] border-[#6393C4]/25 dark:border-[#6393C4]/20',
  admin: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/20',
  treasurer: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/20',
  secretary: 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-500/20',
  member: 'bg-stone-50 dark:bg-[#2E3B4B]/40 text-stone-600 dark:text-white/50 border-stone-200 dark:border-white/10',
};

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
  inactive: 'bg-stone-50 dark:bg-[#2E3B4B]/40 text-stone-500 dark:text-white/35 border-stone-200 dark:border-white/10',
  suspended: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',
};

const CONTRIB_BADGE: Record<string, string> = {
  waiting: 'bg-[#6393C4]/8 dark:bg-[#6393C4]/10 text-[#5289B8] dark:text-[#77A6DB] border-[#6393C4]/20',
  pending: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  paid: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
  overdue: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',
  exempt: 'bg-stone-50 dark:bg-[#2E3B4B]/40 text-stone-500 dark:text-white/35 border-stone-200 dark:border-white/10',
};

function Avatar({ initials, size = 'md' }: { initials: string; size?: 'sm' | 'md' }) {
  const colours = ['from-[#6393C4] to-[#77A6DB]', 'from-purple-500 to-pink-500', 'from-blue-500 to-cyan-500', 'from-teal-500 to-emerald-500', 'from-[#5289B8] to-[#6393C4]'];
  const idx = initials.charCodeAt(0) % colours.length;
  return (
    <div className={cn(
      'rounded-full bg-gradient-to-br flex items-center justify-center flex-shrink-0 font-semibold text-white',
      size === 'md' ? 'w-9 h-9 text-sm' : 'w-7 h-7 text-xs',
      colours[idx],
    )}>
      {initials}
    </div>
  );
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-stone-100 dark:bg-white/8 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold text-stone-600 dark:text-white/70 w-7 text-right">{value}</span>
    </div>
  );
}

function PositionBadge({ position }: { position: number }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[2rem] h-7 px-2 rounded-lg bg-[#6393C4] text-white text-xs font-bold shadow-sm shadow-[#6393C4]/25">
      #{position}
    </span>
  );
}

function MemberDrawer({ member, onClose }: { member: Member; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex"
    >
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="w-full max-w-sm bg-white dark:bg-[#081827] border-l border-stone-100 dark:border-[#1A2A3A] overflow-y-auto"
      >
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <Avatar initials={member.initials} size="md" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-stone-900 dark:text-white">{member.name}</h2>
                {member.joinPosition != null && (
                  <PositionBadge position={member.joinPosition} />
                )}
              </div>
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', ROLE_BADGE[member.role])}>{roleLabel(member.role)}</span>
            </div>
            <button onClick={onClose} className="ml-auto text-stone-400 dark:text-white/30 hover:text-stone-600 dark:hover:text-white text-xl leading-none">×</button>
          </div>

          <div className="space-y-4">
            <div className="bg-stone-50 dark:bg-[#2E3B4B]/35 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-stone-400 dark:text-white/30 uppercase tracking-widest">Payout & Contribution</h3>
              <div className="flex justify-between text-sm">
                <span className="text-stone-400 dark:text-white/40">Payout Position</span>
                <span className="font-semibold text-[#6393C4]">#{member.joinPosition ?? '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-400 dark:text-white/40">Contribution</span>
                <span className="font-medium text-stone-800 dark:text-white">
                  {contributionStatusLabel(member.contributionStatus)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-400 dark:text-white/40">Received Payout</span>
                <span className="font-medium text-stone-800 dark:text-white">
                  {member.hasReceivedPayout ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-400 dark:text-white/40">Credit Score</span>
                <span className="font-medium text-stone-800 dark:text-white">
                  {member.creditScore ?? 70}
                </span>
              </div>
            </div>

            <div className="bg-stone-50 dark:bg-[#2E3B4B]/35 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-stone-400 dark:text-white/30 uppercase tracking-widest">Scores</h3>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-stone-500 dark:text-white/50">Contribution</span>
                </div>
                <ScoreBar value={member.contributionScore} color="bg-emerald-400" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-stone-500 dark:text-white/50">Risk Score</span>
                  <span className={riskColor(member.riskScore)}>{riskLabel(member.riskScore)}</span>
                </div>
                <ScoreBar value={member.riskScore} color={member.riskScore <= 30 ? 'bg-emerald-400' : member.riskScore <= 60 ? 'bg-[#77A6DB]' : 'bg-red-400'} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-500 dark:text-white/50">Reputation</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={cn('w-3 h-3', s <= member.reputation ? 'text-[#6393C4] fill-[#6393C4]' : 'text-stone-200 dark:text-white/10')} />
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-stone-50 dark:bg-[#2E3B4B]/35 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-semibold text-stone-400 dark:text-white/30 uppercase tracking-widest mb-3">Financials</h3>
              {[
                { l: 'Total Contributed', v: formatCurrency(member.totalContributed) },
                { l: 'Missed Payments', v: `${member.missedContributions}` },
                { l: 'Active Loans', v: `${member.activeLoans}` },
                { l: 'Member Since', v: formatDate(member.joinedAt) },
                { l: 'Email', v: member.email || '—' },
              ].map(({ l, v }) => (
                <div key={l} className="flex justify-between text-sm gap-3">
                  <span className="text-stone-400 dark:text-white/40 flex-shrink-0">{l}</span>
                  <span className="font-medium text-stone-800 dark:text-white text-right break-all">{v}</span>
                </div>
              ))}
            </div>

            <div className="bg-stone-50 dark:bg-[#2E3B4B]/35 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-stone-400 dark:text-white/30 uppercase tracking-widest mb-3">Wallet Identity</h3>
              <p className="font-mono text-xs text-stone-600 dark:text-white/60 break-all">{member.walletIdentity}</p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-xl p-4">
      <p className="text-[11px] font-semibold text-stone-400 dark:text-white/30 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-display font-bold text-stone-800 dark:text-white">{value}</p>
    </div>
  );
}

export default function Members() {
  const { activeCooperative } = useCooperative();
  const { walletAddress } = useWallet();
  const { notifications } = useNotifications();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'flagged'>('all');
  const [selected, setSelected] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const reloadMembers = useCallback(() => {
    if (!activeCooperative) {
      setMembers([]);
      return;
    }
    setMembers(loadMembersInPayoutOrder(activeCooperative.id));
  }, [activeCooperative]);

  /** Local reload + merge backend totals / txs so deposits appear live. */
  const syncMembers = useCallback(async () => {
    if (!activeCooperative) {
      setMembers([]);
      return;
    }
    reloadMembers();
    if (!walletAddress) return;

    const serverId = activeCooperative.backendId ?? activeCooperative.id;

    try {
      const res = await apiListMembers(walletAddress, serverId).catch(() =>
        serverId !== activeCooperative.id
          ? apiListMembers(walletAddress, activeCooperative.id)
          : Promise.resolve({ members: [] as Array<Record<string, unknown>> }),
      );
      const remote = (res.members ?? []) as Array<{
        walletIdentity?: string;
        totalContributed?: number;
        contributionStatus?: string;
        name?: string;
        joinPosition?: number;
      }>;
      if (remote.length > 0) {
        mergeRemoteMemberTotals(activeCooperative.id, remote);
      }
    } catch {
      /* local still used */
    }

    // Rebuild contributed totals from the transaction ledger (source of truth)
    try {
      const list = await apiListTransactions(walletAddress, {
        coopId: serverId,
        limit: 200,
      }).catch(async () => {
        if (serverId === activeCooperative.id) return { transactions: [] };
        return apiListTransactions(walletAddress, {
          coopId: activeCooperative.id,
          limit: 200,
        }).catch(() => ({ transactions: [] }));
      });

      // Also load unfiltered wallet txs and use them if coop-filtered list is empty
      let txs = list.transactions ?? [];
      if (txs.length === 0) {
        const all = await apiListTransactions(walletAddress, { limit: 200 }).catch(
          () => ({ transactions: [] as typeof txs }),
        );
        // Prefer txs that match known server id when present
        txs = (all.transactions ?? []).filter(
          (t) =>
            !activeCooperative.backendId ||
            t.coopId === activeCooperative.backendId ||
            t.coopId === activeCooperative.id,
        );
      }

      recomputeContributionsFromTransactions(activeCooperative.id, txs);
    } catch {
      /* ignore */
    }

    reloadMembers();
  }, [activeCooperative, walletAddress, reloadMembers]);

  // Initial load + when cooperative changes
  useEffect(() => {
    void syncMembers();
  }, [syncMembers]);

  // Live updates when treasury credits a contribution
  useEffect(() => {
    const onLocal = (ev: Event) => {
      const detail = (ev as CustomEvent<{ cooperativeId?: string }>).detail;
      if (!activeCooperative) return;
      if (detail?.cooperativeId && detail.cooperativeId !== activeCooperative.id) return;
      reloadMembers();
    };
    window.addEventListener('nexusu:members-updated', onLocal);
    return () => window.removeEventListener('nexusu:members-updated', onLocal);
  }, [activeCooperative, reloadMembers]);

  // When a deposit/contribution notification arrives, re-sync from backend
  useEffect(() => {
    if (!activeCooperative || notifications.length === 0) return;
    const latest = notifications[0];
    if (!latest) return;
    const isMoney =
      latest.type === 'deposit' ||
      latest.type === 'contribution' ||
      latest.type === 'withdrawal';
    if (!isMoney) return;
    void syncMembers();
  }, [notifications, activeCooperative?.id, syncMembers]);

  // Refresh when tab becomes visible again
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void syncMembers();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [syncMembers]);

  const summary = useMemo(
    () => (activeCooperative ? buildCooperativeSummary(activeCooperative, members) : null),
    [activeCooperative, members],
  );

  const filtered = members.filter((m) => {
    const matchSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase());
    if (filter === 'active') return matchSearch && m.status === 'active';
    if (filter === 'flagged') return matchSearch && (m.riskScore > 60 || m.missedContributions > 2);
    return matchSearch;
  });

  if (!activeCooperative) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-full py-24 px-6 text-center">
          <Users className="w-12 h-12 text-stone-200 dark:text-white/10 mb-4" />
          <p className="font-display font-bold text-stone-800 dark:text-white mb-2">No Cooperative</p>
          <p className="text-sm text-stone-400 dark:text-white/40">Create or join a cooperative to see its members.</p>
        </div>
      </DashboardLayout>
    );
  }

  const statusLabel =
    activeCooperative.status.charAt(0).toUpperCase() + activeCooperative.status.slice(1);
  const freqLabel =
    activeCooperative.contributionFrequency.charAt(0).toUpperCase() +
    activeCooperative.contributionFrequency.slice(1);

  return (
    <DashboardLayout>
      <div className="px-6 py-6 max-w-7xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-4 mb-7">
          <div className="flex-1">
            <h1 className="text-xl font-display font-bold text-stone-900 dark:text-white">Members</h1>
            <p className="text-sm text-stone-400 dark:text-white/40 mt-0.5">
              {activeCooperative.name} · {members.length} total · ordered by payout position
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6393C4] text-white text-sm font-semibold hover:bg-[#5289B8] transition-colors">
            <UserPlus className="w-4 h-4" /> Invite Member
          </button>
        </motion.div>

        {/* Cooperative summary */}
        {summary && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6"
          >
            <SummaryTile
              label="Members"
              value={`${summary.memberCount}${summary.maxMembers != null ? ` / ${summary.maxMembers}` : ''}`}
            />
            <SummaryTile
              label="Current Recipient"
              value={`Position #${summary.currentRecipientPosition}`}
            />
            <SummaryTile
              label="Next Recipient"
              value={
                summary.nextRecipientPosition != null
                  ? `Position #${summary.nextRecipientPosition}`
                  : '—'
              }
            />
            <SummaryTile
              label="Contribution"
              value={formatCurrency(summary.contributionAmount, activeCooperative.currency)}
            />
            <SummaryTile label="Frequency" value={freqLabel} />
            <SummaryTile
              label="Payout Strategy"
              value={ROTATION_MODE_LABELS[summary.rotationMode] ?? 'Join Order'}
            />
          </motion.div>
        )}

        {/* Status + joining closed banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.08 }}
          className="flex flex-wrap items-center gap-2 mb-5"
        >
          <span className={cn(
            'text-[11px] font-semibold px-2.5 py-1 rounded-full border',
            activeCooperative.status === 'open'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
              : activeCooperative.status === 'active'
                ? 'bg-[#6393C4]/10 text-[#5289B8] dark:text-[#77A6DB] border-[#6393C4]/25'
                : 'bg-stone-50 dark:bg-[#2E3B4B]/40 text-stone-600 dark:text-white/50 border-stone-200 dark:border-white/10',
          )}>
            Status: {statusLabel}
          </span>
          {summary?.joiningClosed && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20">
              Joining Closed
            </span>
          )}
        </motion.div>

        {/* Search + filters */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex-1 min-w-48 flex items-center gap-2 bg-white dark:bg-stone-900/60 border border-stone-200 dark:border-[#1A2A3A] rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-stone-400 dark:text-white/30 flex-shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members…"
              className="flex-1 bg-transparent text-sm text-stone-700 dark:text-white placeholder:text-stone-400 dark:placeholder:text-white/30 outline-none"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'active', 'flagged'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border',
                  filter === f
                    ? 'bg-[#6393C4] text-white border-[#6393C4]'
                    : 'text-stone-400 dark:text-white/40 border-stone-200 dark:border-white/10 hover:border-stone-300 dark:hover:border-white/20',
                )}
              >
                {f === 'all' ? 'All' : f === 'active' ? 'Active' : '⚠ Flagged'}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Mobile-friendly payout list + desktop table */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl overflow-hidden"
        >
          {/* Card list (mirrors Esusu-style payout order) */}
          <div className="divide-y divide-stone-100 dark:divide-white/5 md:hidden">
            {filtered.map((member, i) => (
              <button
                key={member.id}
                type="button"
                onClick={() => setSelected(member)}
                className="w-full text-left px-4 py-4 hover:bg-stone-50 dark:hover:bg-white/3 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <PositionBadge position={member.joinPosition ?? i + 1} />
                  <Avatar initials={member.initials} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-800 dark:text-white text-sm truncate">{member.name}</p>
                    <p className="text-[11px] text-stone-400 dark:text-white/35">
                      Joined {formatDate(member.joinedAt)}
                    </p>
                  </div>
                  <span className={cn(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0',
                    CONTRIB_BADGE[member.contributionStatus ?? 'waiting'],
                  )}>
                    {contributionStatusLabel(member.contributionStatus)}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Desktop table */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 dark:border-[#1A2A3A]">
                  {['Position', 'Member', 'Role', 'Contribution', 'Risk', 'Status', 'Contributed', 'Joined'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-stone-400 dark:text-white/30 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((member, i) => (
                  <motion.tr
                    key={member.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.02 * i }}
                    onClick={() => setSelected(member)}
                    className="border-b border-stone-50 dark:border-white/4 last:border-0 hover:bg-stone-50 dark:hover:bg-white/3 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <PositionBadge position={member.joinPosition ?? i + 1} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar initials={member.initials} size="sm" />
                        <div>
                          <p className="font-medium text-stone-800 dark:text-white text-sm">{member.name}</p>
                          <p className="text-[11px] text-stone-400 dark:text-white/35">{truncateWallet(member.walletIdentity, 6, 4)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', ROLE_BADGE[member.role] ?? ROLE_BADGE.member)}>
                        {roleLabel(member.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                        CONTRIB_BADGE[member.contributionStatus ?? 'waiting'],
                      )}>
                        {contributionStatusLabel(member.contributionStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[11px] font-semibold', riskColor(member.riskScore))}>
                        {riskLabel(member.riskScore)} ({member.riskScore})
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', STATUS_BADGE[member.status])}>
                        {member.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-stone-600 dark:text-white/60">{formatCurrency(member.totalContributed)}</td>
                    <td className="px-4 py-3 text-xs text-stone-400 dark:text-white/40 whitespace-nowrap">{formatDate(member.joinedAt)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <Hash className="w-8 h-8 text-stone-200 dark:text-white/10 mx-auto mb-3" />
              <p className="text-stone-400 dark:text-white/40 text-sm">No members found matching your search.</p>
            </div>
          )}
        </motion.div>
      </div>

      {selected && <MemberDrawer member={selected} onClose={() => setSelected(null)} />}
    </DashboardLayout>
  );
}

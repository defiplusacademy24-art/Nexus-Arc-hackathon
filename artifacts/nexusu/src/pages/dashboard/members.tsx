import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, UserPlus, Star, TrendingUp, AlertTriangle, Users } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { useCooperative } from '@/providers/CooperativeProvider';
import { loadCoopMembers } from '@/services/cooperative/members';
import { formatCurrency, formatDate, riskColor, riskLabel, roleLabel, scoreBg, truncateWallet } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { Member } from '@/types';

const ROLE_BADGE: Record<string, string> = {
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
              <h2 className="font-display font-bold text-stone-900 dark:text-white">{member.name}</h2>
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', ROLE_BADGE[member.role])}>{roleLabel(member.role)}</span>
            </div>
            <button onClick={onClose} className="ml-auto text-stone-400 dark:text-white/30 hover:text-stone-600 dark:hover:text-white text-xl leading-none">×</button>
          </div>

          <div className="space-y-4">
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
              ].map(({ l, v }) => (
                <div key={l} className="flex justify-between text-sm">
                  <span className="text-stone-400 dark:text-white/40">{l}</span>
                  <span className="font-medium text-stone-800 dark:text-white">{v}</span>
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

export default function Members() {
  const { activeCooperative } = useCooperative();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'flagged'>('all');
  const [selected, setSelected] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  // Reload from localStorage whenever the active cooperative changes
  useEffect(() => {
    setMembers(activeCooperative ? loadCoopMembers(activeCooperative.id) : []);
  }, [activeCooperative?.id]);

  const filtered = members.filter((m) => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase());
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

  return (
    <DashboardLayout>
      <div className="px-6 py-6 max-w-7xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-4 mb-7">
          <div className="flex-1">
            <h1 className="text-xl font-display font-bold text-stone-900 dark:text-white">Members</h1>
            <p className="text-sm text-stone-400 dark:text-white/40 mt-0.5">
              {activeCooperative.name} · {members.length} total · {members.filter(m => m.status === 'active').length} active
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6393C4] text-white text-sm font-semibold hover:bg-[#5289B8] transition-colors">
            <UserPlus className="w-4 h-4" /> Invite Member
          </button>
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

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 dark:border-[#1A2A3A]">
                  {['Member', 'Role', 'Contribution Score', 'Risk', 'Status', 'Contributed', 'Joined'].map((h) => (
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
                      <div className="flex items-center gap-3">
                        <Avatar initials={member.initials} size="sm" />
                        <div>
                          <p className="font-medium text-stone-800 dark:text-white text-sm">{member.name}</p>
                          <p className="text-[11px] text-stone-400 dark:text-white/35">{truncateWallet(member.walletIdentity, 6, 4)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', ROLE_BADGE[member.role])}>
                        {roleLabel(member.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 min-w-[140px]">
                      <ScoreBar value={member.contributionScore} color={member.contributionScore >= 80 ? 'bg-emerald-400' : member.contributionScore >= 60 ? 'bg-[#77A6DB]' : 'bg-red-400'} />
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
              <p className="text-stone-400 dark:text-white/40 text-sm">No members found matching your search.</p>
            </div>
          )}
        </motion.div>
      </div>

      {selected && <MemberDrawer member={selected} onClose={() => setSelected(null)} />}
    </DashboardLayout>
  );
}

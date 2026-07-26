import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PiggyBank, Plus, Calendar, Sparkles } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { useCooperative } from '@/providers/CooperativeProvider';
import { loadSavingsPools } from '@/services/cooperative/savings';
import { loadMembersInPayoutOrder } from '@/services/cooperative/members';
import { formatCurrency, formatDate } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { SavingsPool } from '@/types';

function ProgressRing({ progress, size = 56 }: { progress: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, progress)) / 100) * circ;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={4} className="text-stone-100 dark:text-white/8" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="#6393C4" strokeWidth={4} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        className="transition-all duration-700"
      />
    </svg>
  );
}

function PoolCard({ pool, delay = 0 }: { pool: SavingsPool; delay?: number }) {
  const STATUS_COLORS = {
    active: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
    completed: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
    paused: 'bg-stone-50 dark:bg-[#2E3B4B]/40 text-stone-500 dark:text-white/40 border-stone-200 dark:border-white/10',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5 hover:shadow-md dark:hover:border-white/10 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-5 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#6393C4]/8 dark:bg-[#6393C4]/12 flex items-center justify-center flex-shrink-0">
            <PiggyBank className="w-4.5 h-4.5 text-[#6393C4]" style={{ width: '1.125rem', height: '1.125rem' }} />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-bold text-stone-800 dark:text-white text-sm truncate">{pool.name}</h3>
            <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize', STATUS_COLORS[pool.status])}>
              {pool.status}
            </span>
          </div>
        </div>
        <div className="relative flex items-center justify-center flex-shrink-0">
          <ProgressRing progress={pool.progress} />
          <span className="absolute text-xs font-bold text-stone-800 dark:text-white">{pool.progress}%</span>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5 gap-2 min-w-0">
          <span className="text-stone-400 dark:text-white/40 flex-shrink-0">Progress</span>
          <span className="font-semibold text-stone-700 dark:text-white/80 tabular-nums text-right break-all">
            {formatCurrency(pool.balance)} / {formatCurrency(pool.target)}
          </span>
        </div>
        <div className="h-2 bg-stone-100 dark:bg-white/8 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#6393C4] to-[#77A6DB] rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, pool.progress)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-stone-50 dark:bg-[#2E3B4B]/35 rounded-xl px-2.5 py-2 text-center">
          <p className="text-[10px] text-stone-400 dark:text-white/35 mb-0.5">Contribution</p>
          <p className="text-xs font-bold text-stone-800 dark:text-white">{formatCurrency(pool.contributionAmount)}</p>
        </div>
        <div className="bg-stone-50 dark:bg-[#2E3B4B]/35 rounded-xl px-2.5 py-2 text-center">
          <p className="text-[10px] text-stone-400 dark:text-white/35 mb-0.5">Frequency</p>
          <p className="text-xs font-bold text-stone-800 dark:text-white capitalize">{pool.frequency.replace('-', '\u2011')}</p>
        </div>
        <div className="bg-stone-50 dark:bg-[#2E3B4B]/35 rounded-xl px-2.5 py-2 text-center">
          <p className="text-[10px] text-stone-400 dark:text-white/35 mb-0.5">Members</p>
          <p className="text-xs font-bold text-stone-800 dark:text-white">{pool.memberIds.length}</p>
        </div>
      </div>

      {pool.nextContributionDate && (
        <div className="flex items-center gap-2 mb-4 text-xs text-stone-500 dark:text-white/50">
          <Calendar className="w-3.5 h-3.5 text-stone-400 dark:text-white/30 flex-shrink-0" />
          Next contribution: <span className="font-semibold text-stone-700 dark:text-white/70">{formatDate(pool.nextContributionDate)}</span>
        </div>
      )}

      {pool.aiRecommendation && (
        <div className="bg-[#6393C4]/5 dark:bg-[#6393C4]/8 border border-[#6393C4]/12 rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3 h-3 text-[#6393C4]" />
            <span className="text-[10px] font-semibold text-[#6393C4] uppercase tracking-wide">Nexa</span>
          </div>
          <p className="text-xs text-stone-600 dark:text-white/60 leading-relaxed">{pool.aiRecommendation}</p>
        </div>
      )}
    </motion.div>
  );
}

export default function Savings() {
  const { activeCooperative } = useCooperative();
  const [pools, setPools] = useState<SavingsPool[]>([]);
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    if (!activeCooperative) {
      setPools([]);
      setMemberCount(0);
      return;
    }
    setPools(loadSavingsPools(activeCooperative.id));
    setMemberCount(loadMembersInPayoutOrder(activeCooperative.id).length || activeCooperative.memberCount || 0);
  }, [activeCooperative?.id]);

  const totalBalance = pools.reduce((s, p) => s + p.balance, 0);
  const totalTarget = pools.reduce((s, p) => s + p.target, 0);
  const totalMonthly = pools.reduce((s, p) => s + p.contributionAmount * p.memberIds.length, 0);
  // When no custom pools exist, surface the cooperative's primary contribution schedule as zeros until funded
  const expectedMonthly =
    totalMonthly ||
    (activeCooperative
      ? activeCooperative.contributionAmount * Math.max(memberCount, 0)
      : 0);
  const currency = activeCooperative?.currency ?? 'USD';
  const progressPct = totalTarget > 0 ? Math.round((totalBalance / totalTarget) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 py-5 sm:py-6 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-7"
        >
          <div className="min-w-0">
            <h1 className="text-xl font-display font-bold text-stone-900 dark:text-white">Savings</h1>
            <p className="text-sm text-stone-400 dark:text-white/40 mt-0.5">
              {pools.length} pool{pools.length === 1 ? '' : 's'} · {formatCurrency(totalBalance, currency)} saved
            </p>
          </div>
          <button
            type="button"
            className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl bg-[#6393C4] text-white text-sm font-semibold hover:bg-[#5289B8] transition-colors w-full sm:w-auto flex-shrink-0"
          >
            <Plus className="w-4 h-4" /> New Pool
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-6"
        >
          {[
            { label: 'Total Saved', value: formatCurrency(totalBalance, currency), sub: totalTarget > 0 ? `of ${formatCurrency(totalTarget, currency)} target` : 'No target set', color: 'text-[#6393C4]' },
            { label: 'Expected Monthly', value: formatCurrency(expectedMonthly, currency), sub: activeCooperative ? `${activeCooperative.contributionFrequency} schedule` : 'No cooperative', color: 'text-emerald-500' },
            { label: 'Active Pools', value: String(pools.filter((p) => p.status === 'active').length), sub: pools.length === 0 ? 'None yet' : 'Running now', color: 'text-blue-500' },
            { label: 'Overall Progress', value: totalTarget > 0 ? `${progressPct}%` : '—', sub: 'Across all pools', color: 'text-purple-500' },
          ].map(({ label, value, sub, color }) => (
            <div
              key={label}
              className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-3 sm:p-4 min-w-0"
            >
              <p className="text-[11px] sm:text-xs text-stone-400 dark:text-white/40 mb-1 truncate">{label}</p>
              <p className={`text-base sm:text-xl font-display font-bold tabular-nums break-words ${color}`}>{value}</p>
              <p className="text-[10px] sm:text-[11px] text-stone-400 dark:text-white/35 mt-0.5 line-clamp-2">{sub}</p>
            </div>
          ))}
        </motion.div>

        {pools.length === 0 ? (
          <div className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl py-16 text-center px-6">
            <PiggyBank className="w-10 h-10 text-stone-200 dark:text-white/10 mx-auto mb-3" />
            <p className="font-semibold text-stone-700 dark:text-white/70 mb-1">No savings pools yet</p>
            <p className="text-sm text-stone-400 dark:text-white/40 max-w-md mx-auto">
              {activeCooperative
                ? `Primary contribution is ${formatCurrency(activeCooperative.contributionAmount, currency)} ${activeCooperative.contributionFrequency}. Create a pool when you are ready — balances stay at zero until real contributions land.`
                : 'Create or join a cooperative first. Pools will track real contributions only.'}
            </p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {pools.map((pool, i) => (
              <PoolCard key={pool.id} pool={pool} delay={0.15 + i * 0.05} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

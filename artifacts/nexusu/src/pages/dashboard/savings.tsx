import { motion } from 'framer-motion';
import { PiggyBank, Plus, Calendar, Users, Sparkles, TrendingUp } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { DEMO_SAVINGS_POOLS } from '@/lib/demo-data';
import { formatCurrency, formatDate } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { SavingsPool } from '@/types';

function ProgressRing({ progress, size = 56 }: { progress: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={4} className="text-stone-100 dark:text-white/8" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="#E8461E" strokeWidth={4} strokeLinecap="round"
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
    paused: 'bg-stone-50 dark:bg-white/5 text-stone-500 dark:text-white/40 border-stone-200 dark:border-white/10',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-white/6 rounded-2xl p-5 hover:shadow-md dark:hover:border-white/10 transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#E8461E]/8 dark:bg-[#E8461E]/12 flex items-center justify-center">
            <PiggyBank className="w-4.5 h-4.5 text-[#E8461E]" style={{ width: '1.125rem', height: '1.125rem' }} />
          </div>
          <div>
            <h3 className="font-display font-bold text-stone-800 dark:text-white text-sm">{pool.name}</h3>
            <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize', STATUS_COLORS[pool.status])}>
              {pool.status}
            </span>
          </div>
        </div>

        <div className="relative flex items-center justify-center">
          <ProgressRing progress={pool.progress} />
          <span className="absolute text-xs font-bold text-stone-800 dark:text-white">{pool.progress}%</span>
        </div>
      </div>

      {/* Balance vs target */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-stone-400 dark:text-white/40">Progress</span>
          <span className="font-semibold text-stone-700 dark:text-white/80">
            {formatCurrency(pool.balance)} / {formatCurrency(pool.target)}
          </span>
        </div>
        <div className="h-2 bg-stone-100 dark:bg-white/8 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#E8461E] to-[#F97316] rounded-full transition-all duration-700"
            style={{ width: `${pool.progress}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-stone-50 dark:bg-white/4 rounded-xl px-2.5 py-2 text-center">
          <p className="text-[10px] text-stone-400 dark:text-white/35 mb-0.5">Contribution</p>
          <p className="text-xs font-bold text-stone-800 dark:text-white">{formatCurrency(pool.contributionAmount)}</p>
        </div>
        <div className="bg-stone-50 dark:bg-white/4 rounded-xl px-2.5 py-2 text-center">
          <p className="text-[10px] text-stone-400 dark:text-white/35 mb-0.5">Frequency</p>
          <p className="text-xs font-bold text-stone-800 dark:text-white capitalize">{pool.frequency.replace('-', '\u2011')}</p>
        </div>
        <div className="bg-stone-50 dark:bg-white/4 rounded-xl px-2.5 py-2 text-center">
          <p className="text-[10px] text-stone-400 dark:text-white/35 mb-0.5">Members</p>
          <p className="text-xs font-bold text-stone-800 dark:text-white">{pool.memberIds.length}</p>
        </div>
      </div>

      {/* Next contribution */}
      <div className="flex items-center gap-2 mb-4 text-xs text-stone-500 dark:text-white/50">
        <Calendar className="w-3.5 h-3.5 text-stone-400 dark:text-white/30 flex-shrink-0" />
        Next contribution: <span className="font-semibold text-stone-700 dark:text-white/70">{formatDate(pool.nextContributionDate)}</span>
      </div>

      {/* AI Recommendation */}
      <div className="bg-[#E8461E]/5 dark:bg-[#E8461E]/8 border border-[#E8461E]/12 rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <Sparkles className="w-3 h-3 text-[#E8461E]" />
          <span className="text-[10px] font-semibold text-[#E8461E] uppercase tracking-wide">Nexa</span>
        </div>
        <p className="text-xs text-stone-600 dark:text-white/60 leading-relaxed">{pool.aiRecommendation}</p>
      </div>
    </motion.div>
  );
}

export default function Savings() {
  const totalBalance = DEMO_SAVINGS_POOLS.reduce((s, p) => s + p.balance, 0);
  const totalTarget = DEMO_SAVINGS_POOLS.reduce((s, p) => s + p.target, 0);
  const totalMonthly = DEMO_SAVINGS_POOLS.reduce((s, p) => s + p.contributionAmount * p.memberIds.length, 0);

  return (
    <DashboardLayout>
      <div className="px-6 py-6 max-w-7xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-xl font-display font-bold text-stone-900 dark:text-white">Savings</h1>
            <p className="text-sm text-stone-400 dark:text-white/40 mt-0.5">{DEMO_SAVINGS_POOLS.length} active pools · {formatCurrency(totalBalance)} saved</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E8461E] text-white text-sm font-semibold hover:bg-[#D03D18] transition-colors">
            <Plus className="w-4 h-4" /> New Pool
          </button>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Saved', value: formatCurrency(totalBalance), sub: `of ${formatCurrency(totalTarget)} target`, color: 'text-[#E8461E]' },
            { label: 'Monthly Collections', value: formatCurrency(totalMonthly), sub: 'Expected this month', color: 'text-emerald-500' },
            { label: 'Active Pools', value: String(DEMO_SAVINGS_POOLS.filter(p => p.status === 'active').length), sub: 'Running now', color: 'text-blue-500' },
            { label: 'Overall Progress', value: `${Math.round((totalBalance / totalTarget) * 100)}%`, sub: 'Across all pools', color: 'text-purple-500' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-white/6 rounded-2xl p-4">
              <p className="text-xs text-stone-400 dark:text-white/40 mb-1">{label}</p>
              <p className={`text-xl font-display font-bold ${color}`}>{value}</p>
              <p className="text-[11px] text-stone-400 dark:text-white/35 mt-0.5">{sub}</p>
            </div>
          ))}
        </motion.div>

        {/* Pool cards */}
        <div className="grid lg:grid-cols-2 gap-4">
          {DEMO_SAVINGS_POOLS.map((pool, i) => (
            <PoolCard key={pool.id} pool={pool} delay={0.15 + i * 0.05} />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

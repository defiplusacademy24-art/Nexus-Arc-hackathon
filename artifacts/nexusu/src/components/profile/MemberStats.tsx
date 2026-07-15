import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Banknote, PiggyBank, Vote, Calendar } from 'lucide-react';

interface StatItem {
  label: string;
  value: string;
  subLabel?: string;
  icon: React.ElementType;
  color: string;
}

const STATS: StatItem[] = [
  {
    label: 'Total Contributions',
    value: '$6,300',
    subLabel: '18 months',
    icon: TrendingUp,
    color: 'text-emerald-500',
  },
  {
    label: 'Savings Balance',
    value: '$4,200',
    subLabel: 'Across 2 pools',
    icon: PiggyBank,
    color: 'text-sky-500',
  },
  {
    label: 'Loans Taken',
    value: '1',
    subLabel: '$3,000 total',
    icon: Banknote,
    color: 'text-[#77A6DB]',
  },
  {
    label: 'Repayment Rate',
    value: '98%',
    subLabel: 'Excellent',
    icon: BarChart3,
    color: 'text-[#6393C4]',
  },
  {
    label: 'Governance Votes',
    value: '14',
    subLabel: 'All proposals',
    icon: Vote,
    color: 'text-purple-500',
  },
  {
    label: 'Attendance Rate',
    value: '100%',
    subLabel: 'All meetings',
    icon: Calendar,
    color: 'text-teal-500',
  },
];

interface MemberStatsProps {
  delay?: number;
}

export function MemberStats({ delay = 0 }: MemberStatsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-stone-100 dark:border-[#1A2A3A]">
        <div className="flex items-center gap-2.5">
          <BarChart3 className="w-4 h-4 text-[#6393C4]" />
          <span className="text-sm font-semibold text-stone-800 dark:text-white">
            Member Statistics
          </span>
        </div>
      </div>

      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="p-4 rounded-xl bg-stone-50 dark:bg-[#2E3B4B]/30 border border-stone-100 dark:border-white/5"
            >
              <div className={`mb-2 ${stat.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-xl font-display font-bold text-stone-800 dark:text-white leading-none mb-1">
                {stat.value}
              </p>
              <p className="text-[10px] text-stone-400 dark:text-white/30 font-semibold uppercase tracking-wide leading-tight">
                {stat.label}
              </p>
              {stat.subLabel && (
                <p className="text-[10px] text-stone-400 dark:text-white/25 mt-0.5">{stat.subLabel}</p>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

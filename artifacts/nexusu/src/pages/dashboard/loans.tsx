import { useState } from 'react';
import { motion } from 'framer-motion';
import { Banknote, Clock, CheckCircle2, XCircle, TrendingUp, Sparkles } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { DEMO_LOANS } from '@/lib/demo-data';
import { formatCurrency, formatDate, formatPercent, riskColor, riskLabel } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { Loan, LoanStatus } from '@/types';

const STATUS_CONFIG: Record<LoanStatus, { label: string; class: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', class: 'bg-[#6393C4]/8 dark:bg-[#6393C4]/10 text-[#5289B8] dark:text-[#77A6DB] border-[#6393C4]/20 dark:border-[#6393C4]/20', icon: Clock },
  approved: { label: 'Approved', class: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20', icon: CheckCircle2 },
  active: { label: 'Active', class: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20', icon: TrendingUp },
  rejected: { label: 'Rejected', class: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20', icon: XCircle },
  completed: { label: 'Completed', class: 'bg-stone-50 dark:bg-[#2E3B4B]/40 text-stone-500 dark:text-white/40 border-stone-200 dark:border-white/10', icon: CheckCircle2 },
  defaulted: { label: 'Defaulted', class: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20', icon: XCircle },
};

function Avatar({ initials }: { initials: string }) {
  const cols = ['from-[#6393C4] to-[#77A6DB]', 'from-purple-500 to-pink-500', 'from-blue-500 to-cyan-500', 'from-teal-500 to-emerald-500', 'from-[#5289B8] to-[#6393C4]'];
  return (
    <div className={cn('w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold flex-shrink-0', cols[initials.charCodeAt(0) % cols.length])}>
      {initials}
    </div>
  );
}

function LoanCard({ loan }: { loan: Loan }) {
  const config = STATUS_CONFIG[loan.status];
  const Icon = config.icon;
  const progress = loan.paidAmount && loan.approvedAmount
    ? Math.round((loan.paidAmount / loan.approvedAmount) * 100)
    : undefined;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5 hover:shadow-md dark:hover:border-white/10 transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Avatar initials={loan.borrowerInitials} />
          <div>
            <p className="font-semibold text-stone-800 dark:text-white text-sm">{loan.borrowerName}</p>
            <p className="text-xs text-stone-400 dark:text-white/40">{formatDate(loan.requestedAt)}</p>
          </div>
        </div>
        <span className={cn('flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border', config.class)}>
          <Icon className="w-3 h-3" />
          {config.label}
        </span>
      </div>

      {/* Amount */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-2xl font-display font-bold text-stone-900 dark:text-white">
          {formatCurrency(loan.approvedAmount ?? loan.requestedAmount)}
        </span>
        {loan.status === 'pending' && (
          <span className="text-xs text-stone-400 dark:text-white/40">requested</span>
        )}
      </div>

      {/* Purpose */}
      <p className="text-xs text-stone-500 dark:text-white/50 mb-4 leading-relaxed">{loan.purpose}</p>

      {/* Risk + forecast */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 bg-stone-50 dark:bg-[#2E3B4B]/35 rounded-xl px-3 py-2">
          <p className="text-[10px] text-stone-400 dark:text-white/30 mb-0.5">Risk</p>
          <p className={cn('text-xs font-bold', riskColor(loan.riskScore))}>{riskLabel(loan.riskScore)} ({loan.riskScore})</p>
        </div>
        <div className="flex-1 bg-stone-50 dark:bg-[#2E3B4B]/35 rounded-xl px-3 py-2">
          <p className="text-[10px] text-stone-400 dark:text-white/30 mb-0.5">Repayment</p>
          <p className="text-xs font-bold text-stone-800 dark:text-white">{loan.repaymentForecast}%</p>
        </div>
        <div className="flex-1 bg-stone-50 dark:bg-[#2E3B4B]/35 rounded-xl px-3 py-2">
          <p className="text-[10px] text-stone-400 dark:text-white/30 mb-0.5">Term</p>
          <p className="text-xs font-bold text-stone-800 dark:text-white">{loan.repaymentMonths}mo</p>
        </div>
      </div>

      {/* Progress bar (active loans) */}
      {progress !== undefined && (
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-stone-400 dark:text-white/40">Repaid</span>
            <span className="font-semibold text-stone-700 dark:text-white/80">{formatCurrency(loan.paidAmount!)} / {formatCurrency(loan.approvedAmount!)}</span>
          </div>
          <div className="h-2 bg-stone-100 dark:bg-white/8 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* AI recommendation */}
      <div className="bg-[#6393C4]/5 dark:bg-[#6393C4]/8 border border-[#6393C4]/12 rounded-xl px-3 py-2.5 mb-4">
        <div className="flex items-center gap-1.5 mb-1">
          <Sparkles className="w-3 h-3 text-[#6393C4]" />
          <span className="text-[10px] font-semibold text-[#6393C4] uppercase tracking-wide">Nexa Recommendation</span>
        </div>
        <p className="text-xs text-stone-600 dark:text-white/60 leading-relaxed">{loan.aiRecommendation}</p>
      </div>

      {/* Actions (pending only) */}
      {loan.status === 'pending' && (
        <div className="flex gap-2">
          <button className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">
            Approve
          </button>
          <button className="flex-1 py-2.5 rounded-xl border border-red-200 dark:border-red-500/20 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/8 text-sm font-semibold transition-colors">
            Reject
          </button>
        </div>
      )}
    </motion.div>
  );
}

type FilterTab = 'all' | LoanStatus;

export default function Loans() {
  const [tab, setTab] = useState<FilterTab>('all');

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: DEMO_LOANS.length },
    { key: 'pending', label: 'Pending', count: DEMO_LOANS.filter(l => l.status === 'pending').length },
    { key: 'active', label: 'Active', count: DEMO_LOANS.filter(l => l.status === 'active').length },
    { key: 'completed', label: 'Completed', count: DEMO_LOANS.filter(l => l.status === 'completed').length },
  ];

  const displayed = tab === 'all' ? DEMO_LOANS : DEMO_LOANS.filter(l => l.status === tab);

  return (
    <DashboardLayout>
      <div className="px-6 py-6 max-w-7xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-xl font-display font-bold text-stone-900 dark:text-white">Loans</h1>
            <p className="text-sm text-stone-400 dark:text-white/40 mt-0.5">
              {formatCurrency(DEMO_LOANS.filter(l => l.status === 'active').reduce((s, l) => s + (l.approvedAmount ?? 0), 0))} outstanding · 94.2% repayment rate
            </p>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Pending Review', value: DEMO_LOANS.filter(l => l.status === 'pending').length, color: 'text-[#6393C4]', bg: 'bg-[#6393C4]/8 dark:bg-[#6393C4]/10' },
            { label: 'Active Loans', value: DEMO_LOANS.filter(l => l.status === 'active').length, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
            { label: 'Total Disbursed', value: formatCurrency(DEMO_LOANS.reduce((s, l) => s + (l.approvedAmount ?? 0), 0)), color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
            { label: 'Repayment Rate', value: '94.2%', color: 'text-[#6393C4]', bg: 'bg-[#6393C4]/5 dark:bg-[#6393C4]/10' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={cn('rounded-2xl p-4 border border-stone-100 dark:border-[#1A2A3A]', bg)}>
              <p className="text-xs text-stone-400 dark:text-white/40 mb-1">{label}</p>
              <p className={cn('text-xl font-display font-bold', color)}>{value}</p>
            </div>
          ))}
        </motion.div>

        {/* Tabs */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex gap-1 mb-6 bg-stone-100 dark:bg-[#2E3B4B]/40 rounded-xl p-1 w-fit">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                tab === t.key
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm'
                  : 'text-stone-400 dark:text-white/40 hover:text-stone-600 dark:hover:text-white/60',
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className={cn('ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full', tab === t.key ? 'bg-[#6393C4]/10 text-[#6393C4]' : 'bg-stone-200 dark:bg-white/10 text-stone-500 dark:text-white/40')}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </motion.div>

        {/* Cards */}
        <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayed.map((loan) => (
            <LoanCard key={loan.id} loan={loan} />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

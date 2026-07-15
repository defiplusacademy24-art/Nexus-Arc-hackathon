import { motion } from 'framer-motion';
import { Vault, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { AreaChart } from '@/components/charts/AreaChart';
import { BarChart } from '@/components/charts/BarChart';
import { useCountUp } from '@/hooks/useCountUp';
import { formatCurrency, formatPercent } from '@/utils/format';
import { TREASURY_SNAPSHOT, CASH_FLOW_HISTORY, CONTRIBUTION_TREND } from '@/services/treasury';

function TreasuryCard({ label, value, description, color, icon: Icon, delay = 0 }: {
  label: string; value: number; description?: string;
  color: string; icon: React.ElementType; delay?: number;
}) {
  const count = useCountUp(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4.5 h-4.5" style={{ width: '1.125rem', height: '1.125rem' }} />
        </div>
        <p className="text-xs font-medium text-stone-400 dark:text-white/40">{label}</p>
      </div>
      <p className="text-2xl font-display font-bold text-stone-900 dark:text-white">{formatCurrency(count)}</p>
      {description && <p className="text-[11px] text-stone-400 dark:text-white/35 mt-1">{description}</p>}
    </motion.div>
  );
}

export default function Treasury() {
  const snap = TREASURY_SNAPSHOT;

  return (
    <DashboardLayout>
      <div className="px-6 py-6 max-w-7xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-xl font-display font-bold text-stone-900 dark:text-white">Treasury</h1>
            <p className="text-sm text-stone-400 dark:text-white/40 mt-0.5">Real-time financial overview for Sunshine Savings Cooperative</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-200 dark:border-white/10 text-sm text-stone-500 dark:text-white/50 hover:border-stone-300 dark:hover:border-white/20 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </motion.div>

        {/* Total balance hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-gradient-to-br from-[#6393C4] to-[#77A6DB] rounded-2xl p-7 mb-6 text-white relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)' }} />
          <p className="text-sm font-medium text-white/70 mb-2">Total Treasury Balance</p>
          <p className="text-5xl font-display font-bold mb-2">{formatCurrency(snap.availableBalance + snap.reservedFunds + snap.loanPool)}</p>
          <div className="flex items-center gap-2 text-sm text-white/80">
            <TrendingUp className="w-4 h-4" />
            <span>+8.3% from last month · Net flow: +{formatCurrency(snap.netFlow)}/month</span>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-white/20">
            <div>
              <p className="text-white/60 text-xs mb-1">Monthly Inflow</p>
              <div className="flex items-center gap-1">
                <ArrowUpRight className="w-4 h-4 text-white" />
                <span className="text-lg font-bold">{formatCurrency(snap.monthlyInflow)}</span>
              </div>
            </div>
            <div>
              <p className="text-white/60 text-xs mb-1">Monthly Outflow</p>
              <div className="flex items-center gap-1">
                <ArrowDownRight className="w-4 h-4 text-white/70" />
                <span className="text-lg font-bold text-white/80">{formatCurrency(snap.monthlyOutflow)}</span>
              </div>
            </div>
            <div>
              <p className="text-white/60 text-xs mb-1">Pending Contributions</p>
              <p className="text-lg font-bold">{formatCurrency(snap.pendingContributions)}</p>
            </div>
          </div>
        </motion.div>

        {/* Fund breakdown */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <TreasuryCard label="Available Balance" value={snap.availableBalance} description="Ready to deploy" color="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" icon={Vault} delay={0.1} />
          <TreasuryCard label="Loan Pool" value={snap.loanPool} description="67% utilised" color="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" icon={TrendingUp} delay={0.15} />
          <TreasuryCard label="Emergency Reserve" value={snap.emergencyReserve} description="10.6% of treasury" color="bg-[#6393C4]/8 dark:bg-[#6393C4]/10 text-[#5289B8] dark:text-[#77A6DB]" icon={TrendingDown} delay={0.2} />
          <TreasuryCard label="Reserved Funds" value={snap.reservedFunds} description="Committed expenses" color="bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400" icon={Vault} delay={0.25} />
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Cash flow — wide */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2 bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5"
          >
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-stone-800 dark:text-white">Cash Flow — 12 Months</h2>
              <p className="text-xs text-stone-400 dark:text-white/40 mt-0.5">Inflow vs outflow vs cumulative balance</p>
            </div>
            <AreaChart
              data={CASH_FLOW_HISTORY}
              xKey="month"
              areas={[
                { key: 'balance', label: 'Balance', color: '#6393C4' },
                { key: 'inflow', label: 'Inflow', color: '#10b981' },
                { key: 'outflow', label: 'Outflow', color: '#f59e0b' },
              ]}
              height={260}
              formatY={(v) => `$${(v / 1000).toFixed(0)}K`}
            />
          </motion.div>

          {/* Contribution trend */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5"
          >
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-stone-800 dark:text-white">Contribution Trend</h2>
              <p className="text-xs text-stone-400 dark:text-white/40 mt-0.5">Monthly member contributions</p>
            </div>
            <BarChart
              data={CONTRIBUTION_TREND}
              xKey="label"
              bars={[{ key: 'value', color: '#6393C4', label: 'Contributions' }]}
              height={260}
              formatY={(v) => `$${(v / 1000).toFixed(1)}K`}
            />
          </motion.div>
        </div>

        {/* AI insight */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6 bg-[#6393C4]/5 dark:bg-[#6393C4]/8 border border-[#6393C4]/15 rounded-2xl p-5"
        >
          <p className="text-xs font-semibold text-[#6393C4] uppercase tracking-wide mb-2">✦ Nexa AI Insight</p>
          <p className="text-sm text-stone-700 dark:text-white/75 leading-relaxed">
            At the current growth rate of <strong>8.3% monthly</strong>, your treasury will reach <strong>$60,000 by Q3 2026</strong>.
            The emergency reserve is below the recommended 15% threshold — consider increasing monthly top-ups by $200 to close the gap.
            Your loan pool utilisation is healthy at 67% with a <strong>94.2% repayment rate</strong>.
          </p>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

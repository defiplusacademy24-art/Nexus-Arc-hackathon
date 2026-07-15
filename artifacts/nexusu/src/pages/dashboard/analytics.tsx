import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Users, Banknote, PieChart as PieIcon } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { AreaChart } from '@/components/charts/AreaChart';
import { BarChart } from '@/components/charts/BarChart';
import { CASH_FLOW_HISTORY, CONTRIBUTION_TREND } from '@/services/treasury';
import { MEMBER_GROWTH_DATA, REPAYMENT_RATE_DATA, RISK_DISTRIBUTION } from '@/lib/demo-data';
import { formatCurrency } from '@/utils/format';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function ChartCard({ title, subtitle, children, delay = 0, className = '' }: {
  title: string; subtitle?: string; children: React.ReactNode; delay?: number; className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5 ${className}`}
    >
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-stone-800 dark:text-white">{title}</h2>
        {subtitle && <p className="text-xs text-stone-400 dark:text-white/40 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </motion.div>
  );
}

export default function Analytics() {
  return (
    <DashboardLayout>
      <div className="px-6 py-6 max-w-7xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
          <h1 className="text-xl font-display font-bold text-stone-900 dark:text-white">Analytics</h1>
          <p className="text-sm text-stone-400 dark:text-white/40 mt-0.5">Comprehensive performance overview for Sunshine Savings Cooperative</p>
        </motion.div>

        {/* KPI row */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Treasury Growth', value: '+8.3%', sub: 'Month-over-month', icon: TrendingUp, color: 'text-emerald-500' },
            { label: 'Member Growth', value: '+4 new', sub: 'This quarter', icon: Users, color: 'text-blue-500' },
            { label: 'Loan Volume', value: '$7,000', sub: 'Disbursed this month', icon: Banknote, color: 'text-[#6393C4]' },
            { label: 'Repayment Rate', value: '94.2%', sub: 'All-time record', icon: BarChart3, color: 'text-purple-500' },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <p className="text-xs text-stone-400 dark:text-white/40">{label}</p>
              </div>
              <p className={`text-2xl font-display font-bold ${color}`}>{value}</p>
              <p className="text-[11px] text-stone-400 dark:text-white/35 mt-0.5">{sub}</p>
            </div>
          ))}
        </motion.div>

        {/* Charts row 1 */}
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          <ChartCard title="Treasury Growth" subtitle="12-month balance trajectory" className="lg:col-span-2" delay={0.1}>
            <AreaChart
              data={CASH_FLOW_HISTORY}
              xKey="month"
              areas={[{ key: 'balance', label: 'Balance', color: '#6393C4' }]}
              height={220}
              formatY={(v) => `$${(v / 1000).toFixed(0)}K`}
            />
          </ChartCard>

          <ChartCard title="Risk Distribution" subtitle="Member risk classification" delay={0.15}>
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={RISK_DISTRIBUTION} cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="value" strokeWidth={0}>
                    {RISK_DISTRIBUTION.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} members`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5 w-full mt-2">
                {RISK_DISTRIBUTION.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-xs text-stone-500 dark:text-white/50 flex-1">{d.name}</span>
                    <span className="text-xs font-semibold text-stone-700 dark:text-white/80">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        </div>

        {/* Charts row 2 */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <ChartCard title="Contribution Trend" subtitle="Monthly inflows" delay={0.2}>
            <BarChart
              data={CONTRIBUTION_TREND}
              xKey="label"
              bars={[{ key: 'value', color: '#6393C4', label: 'Contributions' }]}
              height={200}
              formatY={(v) => `$${(v / 1000).toFixed(1)}K`}
            />
          </ChartCard>

          <ChartCard title="Member Growth" subtitle="Cumulative active members" delay={0.25}>
            <AreaChart
              data={MEMBER_GROWTH_DATA}
              xKey="label"
              areas={[{ key: 'value', label: 'Members', color: '#8b5cf6' }]}
              height={200}
              formatY={(v) => String(v)}
            />
          </ChartCard>
        </div>

        {/* Cash flow */}
        <ChartCard title="Cash Flow Analysis" subtitle="Monthly inflow vs outflow" delay={0.3}>
          <BarChart
            data={CASH_FLOW_HISTORY}
            xKey="month"
            bars={[
              { key: 'inflow', color: '#10b981', label: 'Inflow' },
              { key: 'outflow', color: '#f59e0b', label: 'Outflow' },
            ]}
            height={220}
            formatY={(v) => `$${(v / 1000).toFixed(1)}K`}
          />
        </ChartCard>

        {/* Repayment */}
        <ChartCard title="Loan Repayment Rate" subtitle="6-month trend" delay={0.35} className="mt-6">
          <AreaChart
            data={REPAYMENT_RATE_DATA}
            xKey="label"
            areas={[{ key: 'value', label: 'Rate', color: '#10b981' }]}
            height={180}
            formatY={(v) => `${v}%`}
          />
        </ChartCard>
      </div>
    </DashboardLayout>
  );
}

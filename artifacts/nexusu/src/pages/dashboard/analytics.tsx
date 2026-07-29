import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Users, Banknote, Vault } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { AreaChart } from '@/components/charts/AreaChart';
import { BarChart } from '@/components/charts/BarChart';
import { useCooperative } from '@/providers/CooperativeProvider';
import { useWallet } from '@/providers/WalletProvider';
import { loadMembersInPayoutOrder } from '@/services/cooperative/members';
import { loadLoans, outstandingLoansTotal } from '@/services/cooperative/loans';
import {
  buildCashFlowFromTransactions,
  buildContributionTrend,
  sumMonthlyFlows,
} from '@/services/treasury';
import { apiListTransactions } from '@/services/notifications/api';
import { formatCurrency } from '@/utils/format';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { CashFlowPoint, Member } from '@/types';

function ChartCard({ title, subtitle, children, delay = 0, className = '', empty }: {
  title: string; subtitle?: string; children: React.ReactNode; delay?: number; className?: string; empty?: boolean;
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
      {empty ? (
        <div className="h-[200px] flex flex-col items-center justify-center text-center px-4">
          <BarChart3 className="w-8 h-8 text-stone-200 dark:text-white/10 mb-2" />
          <p className="text-xs text-stone-400 dark:text-white/35">No data yet</p>
        </div>
      ) : children}
    </motion.div>
  );
}

export default function Analytics() {
  const { activeCooperative } = useCooperative();
  const { walletAddress } = useWallet();
  const [members, setMembers] = useState<Member[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowPoint[]>([]);
  const [monthlyInflow, setMonthlyInflow] = useState(0);
  const [loanOutstanding, setLoanOutstanding] = useState(0);

  useEffect(() => {
    if (!activeCooperative) {
      setMembers([]);
      setCashFlow([]);
      setMonthlyInflow(0);
      setLoanOutstanding(0);
      return;
    }
    const m = loadMembersInPayoutOrder(activeCooperative.id);
    setMembers(m);
    setLoanOutstanding(outstandingLoansTotal(loadLoans(activeCooperative.id)));
  }, [activeCooperative?.id]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!walletAddress || !activeCooperative) {
        setCashFlow(
          activeCooperative?.treasuryBalance
            ? [{
                month: new Date().toLocaleDateString('en-US', { month: 'short' }),
                inflow: 0,
                outflow: 0,
                balance: activeCooperative.treasuryBalance,
              }]
            : [],
        );
        setMonthlyInflow(0);
        return;
      }
      try {
        const res = await apiListTransactions(walletAddress, {
          coopId: activeCooperative.id,
          limit: 200,
        });
        const txns = res.transactions ?? [];
        if (cancelled) return;
        const flows = sumMonthlyFlows(txns);
        setMonthlyInflow(flows.monthlyInflow);
        setCashFlow(
          buildCashFlowFromTransactions(txns, activeCooperative.treasuryBalance ?? 0),
        );
      } catch {
        if (!cancelled) {
          setCashFlow([]);
          setMonthlyInflow(0);
        }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [walletAddress, activeCooperative?.id, activeCooperative?.treasuryBalance]);

  const contributionTrend = useMemo(
    () => cashFlow.map((p) => ({ label: p.month, value: p.inflow })),
    [cashFlow],
  );

  const memberGrowth = useMemo(() => {
    if (members.length === 0) return [];
    // Build cumulative join curve from real join dates
    const sorted = [...members].sort(
      (a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime(),
    );
    const byMonth = new Map<string, number>();
    sorted.forEach((m, i) => {
      const d = new Date(m.joinedAt);
      const label = Number.isNaN(d.getTime())
        ? `#${i + 1}`
        : d.toLocaleDateString('en-US', { month: 'short' });
      byMonth.set(label, i + 1);
    });
    return [...byMonth.entries()].map(([label, value]) => ({ label, value }));
  }, [members]);

  const riskDistribution = useMemo(() => {
    if (members.length === 0) return [];
    let low = 0;
    let mid = 0;
    let high = 0;
    for (const m of members) {
      if (m.riskScore <= 30) low += 1;
      else if (m.riskScore <= 60) mid += 1;
      else high += 1;
    }
    return [
      { name: 'Low risk', value: low, color: '#10b981' },
      { name: 'Medium risk', value: mid, color: '#f59e0b' },
      { name: 'High risk', value: high, color: '#ef4444' },
    ].filter((d) => d.value > 0);
  }, [members]);

  const treasury = activeCooperative?.treasuryBalance ?? 0;
  const currency = activeCooperative?.currency ?? 'USD';
  const coopName = activeCooperative?.name ?? 'No cooperative selected';

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 py-5 sm:py-6 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
          <h1 className="text-xl font-display font-bold text-stone-900 dark:text-white">Analytics</h1>
          <p className="text-sm text-stone-400 dark:text-white/40 mt-0.5">
            {coopName}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-6"
        >
          {[
            {
              label: 'Treasury',
              value: formatCurrency(treasury, currency),
              sub: 'Live balance',
              icon: Vault,
              color: 'text-emerald-500',
            },
            {
              label: 'Members',
              value: String(members.length || activeCooperative?.memberCount || 0),
              sub: 'On roster',
              icon: Users,
              color: 'text-blue-500',
            },
            {
              label: 'Loans outstanding',
              value: formatCurrency(loanOutstanding, currency),
              sub: 'From loan records',
              icon: Banknote,
              color: 'text-[#6393C4]',
            },
            {
              label: 'Inflow (month)',
              value: formatCurrency(monthlyInflow, currency),
              sub: 'Recorded transactions',
              icon: TrendingUp,
              color: 'text-purple-500',
            },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <div
              key={label}
              className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-3 sm:p-4 min-w-0"
            >
              <div className="flex items-center gap-1.5 sm:gap-2 mb-2 min-w-0">
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${color}`} />
                <p className="text-[11px] sm:text-xs text-stone-400 dark:text-white/40 truncate">{label}</p>
              </div>
              <p className={`text-base sm:text-2xl font-display font-bold tabular-nums break-words ${color}`}>{value}</p>
              <p className="text-[10px] sm:text-[11px] text-stone-400 dark:text-white/35 mt-0.5">{sub}</p>
            </div>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          <ChartCard
            title="Treasury Growth"
            subtitle="From live deposits & withdrawals"
            className="lg:col-span-2"
            delay={0.1}
            empty={cashFlow.length === 0}
          >
            <AreaChart
              data={cashFlow}
              xKey="month"
              areas={[{ key: 'balance', label: 'Balance', color: '#6393C4' }]}
              height={220}
              formatY={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${Math.round(v)}`)}
            />
          </ChartCard>

          <ChartCard
            title="Risk Distribution"
            subtitle="From live member risk scores"
            delay={0.15}
            empty={riskDistribution.length === 0}
          >
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={riskDistribution} cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="value" strokeWidth={0}>
                    {riskDistribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} members`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5 w-full mt-2">
                {riskDistribution.map((d) => (
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

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <ChartCard
            title="Contribution Trend"
            subtitle="Monthly inflows from ledger"
            delay={0.2}
            empty={contributionTrend.length === 0 || contributionTrend.every((p) => p.value === 0)}
          >
            <BarChart
              data={contributionTrend}
              xKey="label"
              bars={[{ key: 'value', color: '#6393C4', label: 'Contributions' }]}
              height={200}
              formatY={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${Math.round(v)}`)}
            />
          </ChartCard>

          <ChartCard
            title="Member Growth"
            subtitle="Cumulative joins by date"
            delay={0.25}
            empty={memberGrowth.length === 0}
          >
            <AreaChart
              data={memberGrowth}
              xKey="label"
              areas={[{ key: 'value', label: 'Members', color: '#8b5cf6' }]}
              height={200}
              formatY={(v) => String(v)}
            />
          </ChartCard>
        </div>

        <ChartCard
          title="Cash Flow Analysis"
          subtitle="Monthly inflow vs outflow"
          delay={0.3}
          empty={cashFlow.length === 0}
        >
          <BarChart
            data={cashFlow}
            xKey="month"
            bars={[
              { key: 'inflow', color: '#10b981', label: 'Inflow' },
              { key: 'outflow', color: '#f59e0b', label: 'Outflow' },
            ]}
            height={220}
            formatY={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${Math.round(v)}`)}
          />
        </ChartCard>

        <ChartCard
          title="Loan Repayment Rate"
          subtitle="Requires real loan repayment events"
          delay={0.35}
          className="mt-6"
          empty
        >
          <div />
        </ChartCard>
      </div>
    </DashboardLayout>
  );
}

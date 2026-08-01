/**
 * Savings Vault — cooperative long-term capital (5% treasury policy).
 * Not personal savings pools.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  PiggyBank, Sparkles, Shield, Banknote, RotateCcw, TrendingUp,
  ArrowDown, Leaf, CheckCircle2, Activity,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { AreaChart } from '@/components/charts/AreaChart';
import { useCooperative } from '@/providers/CooperativeProvider';
import { useWallet } from '@/providers/WalletProvider';
import { useVaultTreasury } from '@/hooks/useVaultTreasury';
import { buildSavingsVaultSnapshot } from '@/services/cooperative/savings-vault';
import { loadLoans } from '@/services/cooperative/loans';
import { TREASURY_ALLOCATION } from '@/services/treasury';
import { formatCurrency, formatDate } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { Loan, SavingsVaultStatus } from '@/types';

const STATUS_STYLE: Record<
  SavingsVaultStatus,
  { label: string; class: string }
> = {
  active: {
    label: 'Active',
    class:
      'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
  },
  growing: {
    label: 'Growing',
    class:
      'bg-[#6393C4]/10 dark:bg-[#6393C4]/15 text-[#5289B8] dark:text-[#77A6DB] border-[#6393C4]/25 dark:border-[#6393C4]/30',
  },
  paused: {
    label: 'Paused',
    class:
      'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  },
};

const ALLOCATION_ROWS = [
  {
    key: 'rotation',
    label: 'Rotation Fund',
    pct: TREASURY_ALLOCATION.rotation * 100,
    color: 'bg-emerald-500',
    bar: 'from-emerald-500 to-emerald-400',
    icon: RotateCcw,
  },
  {
    key: 'loan',
    label: 'Loan Pool',
    pct: TREASURY_ALLOCATION.loanPool * 100,
    color: 'bg-[#6393C4]',
    bar: 'from-[#6393C4] to-[#77A6DB]',
    icon: Banknote,
  },
  {
    key: 'emergency',
    label: 'Emergency Reserve',
    pct: TREASURY_ALLOCATION.emergency * 100,
    color: 'bg-amber-500',
    bar: 'from-amber-500 to-amber-400',
    icon: Shield,
  },
  {
    key: 'savings',
    label: 'Savings Vault',
    pct: TREASURY_ALLOCATION.savings * 100,
    color: 'bg-teal-500',
    bar: 'from-teal-500 to-teal-400',
    icon: PiggyBank,
  },
] as const;

function SummaryCard({
  label,
  value,
  sub,
  icon: Icon,
  delay = 0,
  accent = 'text-[#6393C4]',
  loading = false,
  children,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  delay?: number;
  accent?: string;
  loading?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-3.5 sm:p-5 min-w-0 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-2 sm:mb-3">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#6393C4]/10 flex items-center justify-center flex-shrink-0">
          <Icon className={cn('w-4 h-4', accent)} />
        </div>
        <p className="text-[11px] sm:text-xs font-medium text-stone-400 dark:text-white/40 truncate">
          {label}
        </p>
      </div>
      {children ?? (
        <>
          {loading ? (
            <div className="h-7 sm:h-8 w-24 rounded-md bg-stone-100 dark:bg-white/10 animate-pulse" />
          ) : (
            <p className={cn('text-lg sm:text-2xl font-display font-bold tabular-nums break-words', accent)}>
              {value}
            </p>
          )}
          {(sub || loading) && (
            <p className="text-[10px] sm:text-[11px] text-stone-400 dark:text-white/35 mt-1 line-clamp-2">
              {loading ? 'Loading on-chain…' : sub}
            </p>
          )}
        </>
      )}
    </motion.div>
  );
}

export default function Savings() {
  const { activeCooperative } = useCooperative();
  const { walletAddress } = useWallet();
  const { balance: treasuryCash, isLoading: treasuryLoading } =
    useVaultTreasury(walletAddress);
  const [loans, setLoans] = useState<Loan[]>([]);

  useEffect(() => {
    if (!activeCooperative) {
      setLoans([]);
      return;
    }
    setLoans(loadLoans(activeCooperative.id));
  }, [activeCooperative?.id]);

  useEffect(() => {
    const onLoans = (ev: Event) => {
      const id = (ev as CustomEvent<{ cooperativeId?: string }>).detail?.cooperativeId;
      if (!activeCooperative || (id && id !== activeCooperative.id)) return;
      setLoans(loadLoans(activeCooperative.id));
    };
    window.addEventListener('nexusu:loans-updated', onLoans);
    return () => window.removeEventListener('nexusu:loans-updated', onLoans);
  }, [activeCooperative]);

  const currency = activeCooperative?.currency ?? 'USD';

  const vault = useMemo(
    () =>
      buildSavingsVaultSnapshot(
        treasuryCash,
        loans,
        activeCooperative?.name ?? 'Cooperative',
      ),
    [treasuryCash, loans, activeCooperative?.name],
  );

  const statusCfg = STATUS_STYLE[vault.status];
  const bucketAmounts: Record<string, number> = {
    rotation: vault.rotationFund,
    loan: vault.loanPool,
    emergency: vault.emergencyReserve,
    savings: vault.savingsVault,
  };

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 py-5 sm:py-6 max-w-7xl mx-auto space-y-6">
        {/* Header — no create pool */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-stone-900 dark:text-white">
            Savings Vault
          </h1>
        </motion.div>

        {/* Overview cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <SummaryCard
            label="Total Savings Vault"
            value={formatCurrency(vault.totalSavings, currency)}
            icon={PiggyBank}
            delay={0.05}
            accent="text-[#6393C4]"
            loading={treasuryLoading}
          />
          <SummaryCard
            label="Treasury Allocation"
            value={`${vault.allocationPct}% of Treasury`}
            icon={Leaf}
            delay={0.1}
            accent="text-teal-600 dark:text-teal-400"
            loading={treasuryLoading}
          />
          <SummaryCard
            label="Yield Earned"
            value={formatCurrency(vault.yieldEarned, currency)}
            loading={treasuryLoading}
            icon={TrendingUp}
            delay={0.15}
            accent="text-emerald-600 dark:text-emerald-400"
          />
          <SummaryCard
            label="Savings Status"
            value=""
            icon={Activity}
            delay={0.2}
          >
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full border mt-1',
                statusCfg.class,
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {statusCfg.label}
            </span>
          </SummaryCard>
        </div>

        {/* Treasury allocation breakdown */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-4 sm:p-6 shadow-sm"
        >
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-stone-800 dark:text-white">
              Treasury Allocation
            </h2>
          </div>

          <div className="flex flex-col items-center mb-5">
            <div className="rounded-2xl bg-gradient-to-br from-[#6393C4] to-[#77A6DB] text-white px-5 py-3 text-center shadow-md shadow-[#6393C4]/20 w-full sm:w-auto">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                Cooperative Treasury
              </p>
              <p className="text-2xl font-display font-bold tabular-nums">
                {formatCurrency(vault.treasuryCash || vault.totalSavings * 12, currency)}
              </p>
            </div>
            <ArrowDown className="w-5 h-5 text-stone-300 dark:text-white/25 my-2" />
          </div>

          <div className="h-3 rounded-full overflow-hidden flex mb-5 bg-stone-100 dark:bg-white/8">
            {ALLOCATION_ROWS.map((row) => (
              <div
                key={row.key}
                className={cn('h-full', row.color)}
                style={{ width: `${row.pct}%` }}
                title={`${row.label} ${row.pct}%`}
              />
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {ALLOCATION_ROWS.map((row) => {
              const Icon = row.icon;
              const amt = bucketAmounts[row.key] ?? 0;
              return (
                <div
                  key={row.key}
                  className="rounded-xl border border-stone-100 dark:border-white/8 bg-stone-50/80 dark:bg-[#2E3B4B]/30 p-3 min-w-0"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-white', row.color)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-[11px] font-semibold text-stone-600 dark:text-white/70 truncate">
                      {row.label}
                    </p>
                  </div>
                  <p className="text-lg font-display font-bold text-stone-900 dark:text-white">
                    {row.pct}%
                  </p>
                  <p className="text-xs font-semibold tabular-nums text-stone-500 dark:text-white/45 mt-0.5">
                    {formatCurrency(amt, currency)}
                  </p>
                  <div className="h-1.5 rounded-full bg-stone-200/80 dark:bg-white/10 mt-2 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full bg-gradient-to-r', row.bar)}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* Nexa AI Agent */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-4 sm:p-6 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6393C4] to-[#77A6DB] flex items-center justify-center shadow-md shadow-[#6393C4]/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-sm font-semibold text-stone-800 dark:text-white">
              Nexa AI
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
            {[
              { l: 'Treasury Health', v: vault.treasuryHealth },
              { l: 'Risk Level', v: vault.riskLevel },
              { l: 'Projected Growth', v: `+${vault.projectedAnnualGrowthPct}% annually` },
              { l: 'Next Review', v: `${vault.nextReviewDays} days` },
            ].map(({ l, v }) => (
              <div
                key={l}
                className="rounded-xl border border-stone-100 dark:border-white/8 bg-stone-50/80 dark:bg-[#2E3B4B]/30 px-3 py-2.5 min-w-0"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-white/35">
                  {l}
                </p>
                <p className="text-sm font-bold text-stone-800 dark:text-white mt-0.5 break-words">
                  {v}
                </p>
              </div>
            ))}
          </div>

          {(vault.recommendation || vault.recentDecision) && (
            <div className="rounded-xl border border-[#6393C4]/20 bg-[#6393C4]/5 dark:bg-[#6393C4]/8 px-4 py-3">
              {vault.recommendation && (
                <p className="text-sm text-stone-700 dark:text-white/75">{vault.recommendation}</p>
              )}
              {vault.recentDecision && (
                <p className="text-xs text-stone-500 dark:text-white/45 mt-2">
                  {vault.recentDecision}
                </p>
              )}
            </div>
          )}
        </motion.section>

        {/* Growth chart */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-4 sm:p-6 shadow-sm"
        >
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-stone-800 dark:text-white">
              Savings Growth
            </h2>
          </div>
          <AreaChart
            data={vault.growth}
            xKey="label"
            areas={[
              { key: 'savings', label: 'Savings', color: '#6393C4', fillOpacity: 0.18 },
              { key: 'yield', label: 'Yield', color: '#10b981', fillOpacity: 0.12 },
              { key: 'treasury', label: 'Treasury', color: '#77A6DB', fillOpacity: 0.08 },
            ]}
            height={260}
            formatY={(v) =>
              v >= 1000 ? `${(v / 1000).toFixed(1)}K` : `${Math.round(v)}`
            }
          />
        </motion.section>

        {/* Savings history */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl overflow-hidden shadow-sm"
        >
          <div className="px-4 sm:px-6 py-4 border-b border-stone-50 dark:border-white/4">
            <h2 className="text-sm font-semibold text-stone-800 dark:text-white">Savings History</h2>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-50 dark:border-white/4 bg-stone-50/60 dark:bg-[#2E3B4B]/20">
                  {['Date', 'Description', 'Amount', 'Status'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-semibold text-stone-400 dark:text-white/30 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vault.ledger.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-stone-50 dark:border-white/4 last:border-0"
                  >
                    <td className="px-4 py-3 text-stone-500 dark:text-white/45 whitespace-nowrap">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-4 py-3 text-stone-800 dark:text-white font-medium">
                      {row.description}
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +{formatCurrency(row.amount, currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full capitalize">
                        <CheckCircle2 className="w-3 h-3" />
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-stone-50 dark:divide-white/4">
            {vault.ledger.map((row) => (
              <div key={row.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-800 dark:text-white truncate">
                    {row.description}
                  </p>
                  <p className="text-[11px] text-stone-400 dark:text-white/35 mt-0.5">
                    {formatDate(row.date)} · {row.status}
                  </p>
                </div>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums flex-shrink-0">
                  +{formatCurrency(row.amount, currency)}
                </p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Treasury insights */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26 }}
          className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-4 sm:p-6 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-[#6393C4]" />
            <h2 className="text-sm font-semibold text-stone-800 dark:text-white">
              Treasury Insights
            </h2>
          </div>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {vault.insights.map((insight) => (
              <li
                key={insight}
                className="flex items-start gap-2.5 rounded-xl border border-stone-100 dark:border-white/8 bg-stone-50/60 dark:bg-[#2E3B4B]/25 px-3 py-3"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-stone-700 dark:text-white/70 leading-snug">{insight}</p>
              </li>
            ))}
          </ul>
        </motion.section>

      </div>
    </DashboardLayout>
  );
}

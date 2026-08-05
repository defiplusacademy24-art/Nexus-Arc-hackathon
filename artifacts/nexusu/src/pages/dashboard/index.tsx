import type { ElementType } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Users, Vault, Banknote,
  PiggyBank, Scale, Sparkles, Activity, ArrowRight,
  Building2, Plus,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { AreaChart } from '@/components/charts/AreaChart';
import { useCountUp } from '@/hooks/useCountUp';
import { useVaultTreasury } from '@/hooks/useVaultTreasury';
import { useWallet } from '@/providers/WalletProvider';
import { useCooperative } from '@/providers/CooperativeProvider';
import { useProfile } from '@/hooks/useProfile';
import { getPreferredDisplayName } from '@/services/profile';
import { loadMembersInPayoutOrder } from '@/services/cooperative/members';
import { buildCooperativeSummary, ROTATION_MODE_LABELS } from '@/services/cooperative/rotation';
import {
  loadLoans,
  outstandingLoansTotal,
  totalDisbursedAmount,
  pendingReviewCount,
} from '@/services/cooperative/loans';
import { apiListTransactions } from '@/services/notifications/api';
import { formatCurrency, formatDate } from '@/utils/format';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import type { CashFlowPoint, Loan, Member } from '@/types';
import {
  fetchVaultContributionStats,
} from '@/services/treasury/vault';

// ── Animated Stat Card ─────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  format?: 'currency' | 'number' | 'percent' | 'score';
  suffix?: string;
  prefix?: string;
  change?: number;
  changeLabel?: string;
  icon: ElementType;
  iconColor?: string;
  href?: string;
  delay?: number;
  empty?: boolean;
  /** When true, show a skeleton instead of a stale/cached number. */
  loading?: boolean;
}

function StatCard({
  label, value, format = 'currency', suffix = '', prefix = '',
  change, changeLabel, icon: Icon, iconColor = 'text-[#6393C4]',
  href, delay = 0, empty = false, loading = false,
}: StatCardProps) {
  const count = useCountUp(empty || loading ? 0 : value, 900, !empty && !loading);

  const formatted = (() => {
    if (loading) return null;
    if (empty && value === 0) {
      if (format === 'currency') return formatCurrency(0);
      if (format === 'percent') return '—';
      if (format === 'score') return '—';
      return '0';
    }
    if (format === 'currency') return formatCurrency(count);
    if (format === 'percent') return `${count}%`;
    if (format === 'score') return `${count}/100`;
    return count.toLocaleString();
  })();

  const card = (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="surface-card-hover p-3.5 sm:p-5 cursor-pointer group min-w-0"
    >
      <div className="flex items-start justify-between gap-2 mb-3 sm:mb-4">
        <div className={cn('w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center bg-stone-50/90 dark:bg-white/[0.04] border border-stone-100/80 dark:border-white/[0.06] flex-shrink-0')}>
          <Icon className={cn('w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]', iconColor)} />
        </div>
        {change !== undefined && !empty && !loading && (
          <div className={cn(
            'flex items-center gap-1 text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full flex-shrink-0',
            change >= 0
              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
          )}>
            {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-7 sm:h-8 w-24 sm:w-28 rounded-md bg-stone-100 dark:bg-white/10 animate-pulse mb-1" />
      ) : (
        <p className="text-lg sm:text-2xl font-display font-bold text-stone-900 dark:text-white mb-1 tabular-nums break-words">
          {prefix}{formatted}{suffix}
        </p>
      )}
      <p className="text-[11px] sm:text-xs text-stone-500 dark:text-white/40 font-medium leading-snug tracking-tight">
        {label}
        {loading && (
          <span className="ml-1 text-stone-300 dark:text-white/25 block sm:inline">· loading</span>
        )}
        {changeLabel && !empty && !loading && (
          <span className="ml-1 text-stone-400 dark:text-white/30 block sm:inline">· {changeLabel}</span>
        )}
      </p>
    </motion.div>
  );

  if (href) return <Link href={href}>{card}</Link>;
  return card;
}

type LiveInsight = {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'success' | 'alert';
};

function buildLiveInsights(input: {
  coopName: string;
  memberCount: number;
  maxMembers?: number;
  treasury: number;
  monthlyInflow: number;
  status: string;
  rotationLabel: string;
  contributionAmount: number;
  currency: string;
}): LiveInsight[] {
  const insights: LiveInsight[] = [];
  const {
    coopName, memberCount, maxMembers, treasury, monthlyInflow,
    status, rotationLabel, contributionAmount, currency,
  } = input;

  if (memberCount <= 1) {
    insights.push({
      id: 'invite',
      title: 'Invite members',
      body: `Share the invite code to grow ${coopName}.`,
      severity: 'info',
    });
  } else {
    insights.push({
      id: 'roster',
      title: `${memberCount} members`,
      body: maxMembers
        ? `${memberCount} of ${maxMembers} · ${rotationLabel}`
        : `${rotationLabel}`,
      severity: 'success',
    });
  }

  if (treasury <= 0) {
    insights.push({
      id: 'treasury-empty',
      title: 'Treasury empty',
      body: `First contribution: ${formatCurrency(contributionAmount, currency)} per cycle.`,
      severity: 'warning',
    });
  } else {
    insights.push({
      id: 'treasury-live',
      title: 'Treasury',
      body: `${formatCurrency(treasury, currency)}${monthlyInflow > 0 ? ` · ${formatCurrency(monthlyInflow, currency)} this month` : ''}`,
      severity: 'success',
    });
  }

  if (status === 'open' || status === 'draft') {
    insights.push({
      id: 'status-open',
      title: 'Open for joining',
      body: 'Start when the roster is ready to lock payout order.',
      severity: 'info',
    });
  } else if (status === 'active') {
    insights.push({
      id: 'status-active',
      title: 'Active',
      body: 'Joining closed · contributions on schedule.',
      severity: 'success',
    });
  }

  return insights.slice(0, 3);
}

function buildCashFlowFromTxns(
  txns: Array<{ type: string; amount: number; createdAt: string }>,
  currentBalance: number,
): CashFlowPoint[] {
  if (txns.length === 0) {
    if (currentBalance <= 0) return [];
    const month = new Date().toLocaleDateString('en-US', { month: 'short' });
    return [{ month, inflow: 0, outflow: 0, balance: currentBalance }];
  }

  type MonthBucket = { label: string; inflow: number; outflow: number };
  const byMonth = new Map<string, MonthBucket>();
  for (const t of txns) {
    const d = new Date(t.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short' });
    const entry = byMonth.get(key) ?? { label, inflow: 0, outflow: 0 };
    if (t.type === 'withdrawal') entry.outflow += t.amount;
    else entry.inflow += t.amount;
    byMonth.set(key, entry);
  }

  const sorted = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  // Reconstruct approximate month-end balances working backwards from current
  let running = currentBalance;
  const points: CashFlowPoint[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const [, v] = sorted[i];
    points.unshift({
      month: v.label,
      inflow: Math.round(v.inflow * 100) / 100,
      outflow: Math.round(v.outflow * 100) / 100,
      balance: Math.round(running * 100) / 100,
    });
    running = running - v.inflow + v.outflow;
  }
  return points;
}

// ── Overview Page ──────────────────────────────────────────────────────────────

export default function Overview() {
  const { identity, walletAddress } = useWallet();
  const { activeCooperative, cooperatives } = useCooperative();
  const { prefs } = useProfile();
  const {
    balance: vaultBalance,
    isLoading: treasuryLoading,
    isReady: treasuryReady,
    vaultConfigured,
    paidCount: vaultPaidCount,
    contributionAmount: vaultContribAmount,
  } = useVaultTreasury(walletAddress);
  const [members, setMembers] = useState<Member[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [monthlyInflow, setMonthlyInflow] = useState(0);
  const [monthlyOutflow, setMonthlyOutflow] = useState(0);
  const [cashFlow, setCashFlow] = useState<CashFlowPoint[]>([]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const displayName = getPreferredDisplayName({
    prefs,
    identityDisplayName: identity?.displayName,
    nametag: identity?.nametag,
    fallback: 'there',
  });
  const coopName = activeCooperative?.name ?? 'your cooperative';

  const reloadLoans = useCallback(() => {
    if (!activeCooperative) {
      setLoans([]);
      return;
    }
    setLoans(loadLoans(activeCooperative.id));
  }, [activeCooperative]);

  useEffect(() => {
    if (!activeCooperative) {
      setMembers([]);
      setLoans([]);
      return;
    }
    setMembers(loadMembersInPayoutOrder(activeCooperative.id));
    reloadLoans();
  }, [activeCooperative?.id, reloadLoans]);

  // Live loan portfolio when AI Lending Agent approves applications
  useEffect(() => {
    const onLoans = (ev: Event) => {
      const id = (ev as CustomEvent<{ cooperativeId?: string }>).detail?.cooperativeId;
      if (!activeCooperative || (id && id !== activeCooperative.id)) return;
      reloadLoans();
    };
    window.addEventListener('nexusu:loans-updated', onLoans);
    return () => window.removeEventListener('nexusu:loans-updated', onLoans);
  }, [activeCooperative, reloadLoans]);

  useEffect(() => {
    let cancelled = false;
    async function loadTx() {
      // Wait for on-chain cash before charting so we never seed charts with stale ledger totals.
      if (vaultConfigured && !treasuryReady) {
        setMonthlyInflow(0);
        setMonthlyOutflow(0);
        setCashFlow([]);
        return;
      }

      const chainBal = vaultConfigured
        ? vaultBalance
        : (activeCooperative?.treasuryBalance ?? 0);

      // Production path: monthly contributions from vault ContributionDeposited history
      if (vaultConfigured) {
        try {
          const stats = await fetchVaultContributionStats(
            undefined,
            activeCooperative?.treasuryVaultAddress,
          );
          if (cancelled) return;
          setMonthlyInflow(stats.monthlyInflow);
          setMonthlyOutflow(0);
          // Build simple cash-flow points from on-chain records
          const byMonth = new Map<string, { inflow: number; ts: number }>();
          for (const r of stats.records) {
            const d = new Date(r.timestamp * 1000);
            const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            const prev = byMonth.get(key) ?? { inflow: 0, ts: r.timestamp };
            byMonth.set(key, { inflow: prev.inflow + r.amount, ts: Math.min(prev.ts, r.timestamp) });
          }
          const points = [...byMonth.entries()]
            .sort((a, b) => a[1].ts - b[1].ts)
            .map(([month, v]) => ({
              month,
              inflow: Math.round(v.inflow * 100) / 100,
              outflow: 0,
              balance: chainBal,
            }));
          if (points.length === 0 && chainBal > 0) {
            points.push({
              month: new Date().toLocaleDateString('en-US', { month: 'short' }),
              inflow: stats.monthlyInflow,
              outflow: 0,
              balance: chainBal,
            });
          }
          // Reconstruct approximate running balance for chart (end = chain bal)
          if (points.length > 0) {
            let run = chainBal;
            for (let i = points.length - 1; i >= 0; i--) {
              points[i]!.balance = Math.round(run * 100) / 100;
              run = Math.max(0, run - points[i]!.inflow);
            }
          }
          setCashFlow(points);
          return;
        } catch {
          // Older vaults without getAllContributions: use cycle paid × amount
          if (!cancelled && vaultPaidCount > 0 && vaultContribAmount > 0) {
            const approx = Math.round(vaultPaidCount * vaultContribAmount * 100) / 100;
            setMonthlyInflow(approx);
            setMonthlyOutflow(0);
            setCashFlow(
              chainBal > 0
                ? [{
                    month: new Date().toLocaleDateString('en-US', { month: 'short' }),
                    inflow: approx,
                    outflow: 0,
                    balance: chainBal,
                  }]
                : [],
            );
            return;
          }
        }
      }

      if (!walletAddress || !activeCooperative) {
        setMonthlyInflow(0);
        setMonthlyOutflow(0);
        setCashFlow(
          chainBal > 0
            ? [{
                month: new Date().toLocaleDateString('en-US', { month: 'short' }),
                inflow: 0,
                outflow: 0,
                balance: chainBal,
              }]
            : [],
        );
        return;
      }
      try {
        const res = await apiListTransactions(walletAddress, {
          coopId: activeCooperative.id,
          limit: 200,
        });
        let txns = res.transactions ?? [];
        if (vaultConfigured) {
          txns = txns.filter((t) => {
            const n = String((t as { note?: string }).note ?? '').toLowerCase();
            return n.includes('on-chain') || n.includes('arc vault');
          });
        }
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        let inflow = 0;
        let outflow = 0;
        for (const t of txns) {
          if (new Date(t.createdAt).getTime() < monthStart) continue;
          if (t.type === 'withdrawal') outflow += t.amount;
          else inflow += t.amount;
        }
        if (cancelled) return;
        setMonthlyInflow(inflow);
        setMonthlyOutflow(outflow);
        setCashFlow(
          chainBal > 0 || txns.length > 0
            ? buildCashFlowFromTxns(txns, chainBal)
            : [],
        );
      } catch {
        if (cancelled) return;
        setMonthlyInflow(0);
        setMonthlyOutflow(0);
        setCashFlow([]);
      }
    }
    void loadTx();
    return () => { cancelled = true; };
  }, [
    walletAddress,
    activeCooperative?.id,
    activeCooperative?.treasuryBalance,
    vaultConfigured,
    treasuryReady,
    vaultBalance,
    vaultPaidCount,
    vaultContribAmount,
  ]);

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === 'active').length,
    [members],
  );
  const totalContributed = useMemo(
    () => members.reduce((s, m) => s + (m.totalContributed ?? 0), 0),
    [members],
  );
  const summary = useMemo(
    () => (activeCooperative ? buildCooperativeSummary(activeCooperative, members) : null),
    [activeCooperative, members],
  );

  // Prefer live vault cash; while loading, keep 0 + loading flag (never stale cache).
  const treasury = vaultConfigured
    ? vaultBalance
    : (activeCooperative?.treasuryBalance ?? 0);
  const currency = activeCooperative?.currency ?? 'USD';
  const loansOutstanding = outstandingLoansTotal(loans);
  const loansDisbursed = totalDisbursedAmount(loans);
  const pendingLoans = pendingReviewCount(loans);
  const approvedLoans = useMemo(
    () =>
      loans
        .filter((l) => l.status === 'approved' || l.status === 'active' || l.status === 'completed')
        .slice(0, 5),
    [loans],
  );

  const insights = useMemo(() => {
    if (!activeCooperative) return [];
    return buildLiveInsights({
      coopName: activeCooperative.name,
      memberCount: members.length || activeCooperative.memberCount || 0,
      maxMembers: activeCooperative.maxMembers,
      treasury,
      monthlyInflow,
      status: activeCooperative.status,
      rotationLabel: ROTATION_MODE_LABELS[summary?.rotationMode ?? 'JOIN_ORDER'],
      contributionAmount: activeCooperative.contributionAmount,
      currency,
    });
  }, [activeCooperative, members.length, treasury, monthlyInflow, summary?.rotationMode, currency]);

  // Empty state when user has no cooperative yet
  if (!activeCooperative) {
    return (
      <DashboardLayout>
        <div className="px-4 sm:px-6 py-5 sm:py-6 max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
            <h1 className="text-xl sm:text-2xl font-display font-semibold tracking-tight text-stone-900 dark:text-white">
              {greeting}, {displayName}
            </h1>
            <p className="text-[13px] text-stone-500 dark:text-white/40 mt-1">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
          </motion.div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
            <StatCard label="Total Treasury" value={0} format="currency" icon={Vault} empty delay={0} />
            <StatCard label="Monthly Contributions" value={0} format="currency" icon={PiggyBank} empty delay={0.05} />
            <StatCard label="Active Members" value={0} format="number" icon={Users} empty delay={0.1} />
            <StatCard label="Loans Outstanding" value={0} format="currency" icon={Banknote} empty delay={0.15} />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="surface-card p-8 sm:p-10 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-stone-50 dark:bg-white/[0.04] border border-stone-100 dark:border-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-6 h-6 text-stone-300 dark:text-white/20" />
            </div>
            <h2 className="font-display font-semibold text-stone-800 dark:text-white mb-1.5 tracking-tight">
              No cooperative yet
            </h2>
            <p className="text-sm text-stone-500 dark:text-white/40 mb-6 max-w-sm mx-auto">
              Create a cooperative or join with an invite code.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/dashboard/cooperatives"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#6393C4] text-white text-sm font-semibold hover:bg-[#5289B8] shadow-sm shadow-[#6393C4]/25 transition-colors"
              >
                <Plus className="w-4 h-4" /> Create or join
              </Link>
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 py-5 sm:py-8 max-w-7xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 sm:mb-8"
        >
          <h1 className="text-xl sm:text-2xl font-display font-semibold tracking-tight text-stone-900 dark:text-white break-words">
            {greeting}, {displayName}
          </h1>
          <p className="text-[13px] text-stone-500 dark:text-white/40 mt-1 break-words">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {' · '}
            <span className="text-stone-700 dark:text-white/70 font-medium">{coopName}</span>
            {summary && (
              <span className="ml-1 text-stone-400 dark:text-white/35">
                · {summary.memberCount}
                {summary.maxMembers != null ? ` / ${summary.maxMembers}` : ''} members
                {summary.status === 'active' ? ' · Active' : ` · ${summary.status}`}
              </span>
            )}
          </p>
        </motion.div>

        {/* Stat cards — live cooperative data */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <StatCard
            label="Cash on hand"
            value={treasury}
            format="currency"
            loading={treasuryLoading}
            changeLabel={
              !treasuryLoading && loansOutstanding > 0
                ? `+ ${formatCurrency(loansOutstanding, currency)} outstanding`
                : undefined
            }
            icon={Vault}
            href="/dashboard/treasury"
            delay={0}
          />
          <StatCard
            label="Monthly Contributions"
            value={monthlyInflow}
            format="currency"
            loading={treasuryLoading}
            changeLabel={!treasuryLoading && monthlyInflow > 0 ? 'this month' : undefined}
            icon={PiggyBank}
            href="/dashboard/savings"
            delay={0.05}
          />
          <StatCard
            label="Active Members"
            value={activeMembers || members.length || activeCooperative.memberCount || 0}
            format="number"
            changeLabel={
              activeCooperative.maxMembers
                ? `of ${activeCooperative.maxMembers} max`
                : undefined
            }
            icon={Users}
            href="/dashboard/members"
            delay={0.1}
          />
          <StatCard
            label="Loans Outstanding"
            value={loansOutstanding}
            format="currency"
            changeLabel={
              loansDisbursed > 0
                ? `${formatCurrency(loansDisbursed, currency)} total disbursed`
                : pendingLoans > 0
                  ? `${pendingLoans} pending review`
                  : 'no loans yet'
            }
            icon={Banknote}
            href="/dashboard/loans"
            delay={0.15}
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-6">
          <StatCard
            label="Net Flow (month)"
            value={Math.round((monthlyInflow - monthlyOutflow) * 100) / 100}
            format="currency"
            icon={TrendingUp}
            iconColor={monthlyInflow - monthlyOutflow >= 0 ? 'text-emerald-500' : 'text-red-500'}
            delay={0.2}
          />
          <StatCard
            label="Open proposals"
            value={0}
            format="number"
            changeLabel="Governance"
            icon={Scale}
            iconColor="text-purple-500"
            href="/dashboard/governance"
            delay={0.25}
            empty
          />
          <StatCard
            label="Contribution / cycle"
            value={activeCooperative.contributionAmount}
            format="currency"
            changeLabel={
              activeCooperative.contributionFrequency === 'bi-weekly'
                ? 'Bi-weekly'
                : activeCooperative.contributionFrequency === 'weekly'
                  ? 'Weekly'
                  : 'Monthly'
            }
            icon={Activity}
            iconColor="text-teal-500"
            delay={0.3}
          />
          <StatCard
            label="Members paid (cycle)"
            value={vaultConfigured ? vaultPaidCount : activeMembers || members.length || 0}
            format="number"
            changeLabel={
              vaultConfigured && vaultContribAmount > 0
                ? `${formatCurrency(vaultContribAmount, currency)} each`
                : activeCooperative.maxMembers
                  ? `of ${activeCooperative.maxMembers}`
                  : undefined
            }
            icon={Sparkles}
            iconColor="text-[#6393C4]"
            delay={0.35}
          />
        </div>

        {/* Lending snapshot — what the cooperative has lent to members */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
          className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5 mb-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-semibold text-stone-800 dark:text-white">Lending overview</h2>
            <Link
              href="/dashboard/loans"
              className="text-xs font-semibold text-[#6393C4] hover:underline flex items-center gap-1"
            >
              Loans <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {[
              { l: 'Cash on hand', v: formatCurrency(treasury, currency) },
              { l: 'Outstanding', v: formatCurrency(loansOutstanding, currency) },
              { l: 'Disbursed', v: formatCurrency(loansDisbursed, currency) },
              { l: 'Cash + loans', v: formatCurrency(treasury + loansOutstanding, currency) },
            ].map(({ l, v }) => (
              <div
                key={l}
                className="rounded-xl bg-stone-50 dark:bg-[#2E3B4B]/35 border border-stone-100 dark:border-white/6 px-3 py-2.5"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-white/35 mb-0.5">
                  {l}
                </p>
                <p className="text-sm font-display font-bold text-stone-800 dark:text-white">{v}</p>
              </div>
            ))}
          </div>

          {approvedLoans.length === 0 ? (
            <p className="text-xs text-stone-400 dark:text-white/35 py-2">
              No loans yet
            </p>
          ) : (
            <div className="divide-y divide-stone-100 dark:divide-white/5">
              {approvedLoans.map((loan) => (
                <div key={loan.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6393C4] to-[#77A6DB] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                    {loan.borrowerInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800 dark:text-white truncate">
                      {loan.borrowerName}
                    </p>
                    <p className="text-[11px] text-stone-400 dark:text-white/35 truncate">
                      {loan.purposeCategory ?? loan.purpose}
                      {' · '}
                      {formatDate(loan.requestedAt)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-stone-800 dark:text-white">
                      {formatCurrency(loan.approvedAmount ?? loan.requestedAmount, currency)}
                    </p>
                    <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 capitalize">
                      {loan.status === 'approved' ? 'Disbursed' : loan.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Treasury chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5 mb-6"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-stone-800 dark:text-white">Treasury Growth</h2>
            <Link href="/dashboard/treasury" className="text-xs text-[#6393C4] font-semibold flex items-center gap-1 hover:underline">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {cashFlow.length === 0 ? (
            <div className="h-[220px] flex flex-col items-center justify-center text-center px-6">
              <Vault className="w-8 h-8 text-stone-200 dark:text-white/10 mb-3" />
              <p className="text-sm font-medium text-stone-500 dark:text-white/45">No activity yet</p>
              <Link
                href="/dashboard/treasury"
                className="mt-4 text-xs font-semibold text-[#6393C4] hover:underline"
              >
                Go to Treasury
              </Link>
            </div>
          ) : (
            <AreaChart
              data={cashFlow}
              xKey="month"
              areas={[
                { key: 'balance', label: 'Balance', color: '#6393C4' },
                { key: 'inflow', label: 'Inflow', color: '#10b981' },
              ]}
              height={220}
              formatY={(v) =>
                v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${Math.round(v)}`
              }
            />
          )}
        </motion.div>

        {/* Live cooperative summary + AI insights */}
        <div className="grid lg:grid-cols-2 gap-6">
          {summary && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-[#6393C4]" />
                <h2 className="text-sm font-semibold text-stone-800 dark:text-white">Cooperative Summary</h2>
                <Link href="/dashboard/cooperatives" className="ml-auto text-xs text-[#6393C4] font-semibold hover:underline">
                  Manage
                </Link>
              </div>
              <div className="space-y-2.5">
                {[
                  {
                    l: 'Members',
                    v: `${summary.memberCount}${summary.maxMembers != null ? ` / ${summary.maxMembers}` : ''}`,
                  },
                  { l: 'Current Recipient', v: `Position #${summary.currentRecipientPosition}` },
                  {
                    l: 'Next Recipient',
                    v: summary.nextRecipientPosition != null
                      ? `Position #${summary.nextRecipientPosition}`
                      : '—',
                  },
                  {
                    l: 'Contribution',
                    v: formatCurrency(summary.contributionAmount, currency),
                  },
                  {
                    l: 'Frequency',
                    v: summary.contributionFrequency.charAt(0).toUpperCase() +
                      summary.contributionFrequency.slice(1),
                  },
                  {
                    l: 'Status',
                    v: summary.status.charAt(0).toUpperCase() + summary.status.slice(1),
                  },
                  { l: 'Payout Strategy', v: summary.rotationModeLabel },
                ].map(({ l, v }) => (
                  <div
                    key={l}
                    className="flex justify-between items-center py-2 border-b border-stone-50 dark:border-white/4 last:border-0"
                  >
                    <span className="text-sm text-stone-400 dark:text-white/40">{l}</span>
                    <span className="text-sm font-semibold text-stone-700 dark:text-white/80">{v}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-[#6393C4]" />
              <h2 className="text-sm font-semibold text-stone-800 dark:text-white">Nexa AI Insights</h2>
              <Link href="/dashboard/nexa" className="ml-auto text-xs text-[#6393C4] font-semibold hover:underline">Ask Nexa</Link>
            </div>
            <div className="space-y-3">
              {insights.length === 0 ? (
                <p className="text-xs text-stone-400 dark:text-white/35 py-4 text-center">
                  Insights will appear once your cooperative has activity.
                </p>
              ) : (
                insights.map((insight) => (
                  <div key={insight.id} className={cn(
                    'flex items-start gap-3 p-3 rounded-xl border text-xs',
                    insight.severity === 'success' && 'bg-emerald-50 dark:bg-emerald-500/6 border-emerald-100 dark:border-emerald-500/15',
                    insight.severity === 'warning' && 'bg-[#6393C4]/8 dark:bg-[#6393C4]/10 border-[#6393C4]/15 dark:border-[#6393C4]/15',
                    insight.severity === 'info' && 'bg-blue-50 dark:bg-blue-500/6 border-blue-100 dark:border-blue-500/15',
                    insight.severity === 'alert' && 'bg-red-50 dark:bg-red-500/6 border-red-100 dark:border-red-500/15',
                  )}>
                    <div className={cn(
                      'w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1',
                      insight.severity === 'success' && 'bg-emerald-400',
                      insight.severity === 'warning' && 'bg-[#77A6DB]',
                      insight.severity === 'info' && 'bg-blue-400',
                      insight.severity === 'alert' && 'bg-red-400',
                    )} />
                    <div>
                      <p className="font-semibold text-stone-700 dark:text-white/85">{insight.title}</p>
                      <p className="text-stone-500 dark:text-white/50 mt-0.5 leading-relaxed">{insight.body}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}

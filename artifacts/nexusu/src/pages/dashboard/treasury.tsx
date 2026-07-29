import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Vault, TrendingUp, ArrowUpRight, ArrowDownRight,
  RefreshCw, Banknote, CheckCircle2,
  RotateCcw, Shield, PiggyBank,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { AreaChart } from '@/components/charts/AreaChart';
import { BarChart } from '@/components/charts/BarChart';
import { useCountUp } from '@/hooks/useCountUp';
import { useWallet } from '@/providers/WalletProvider';
import { useCooperative } from '@/providers/CooperativeProvider';
import { formatCurrency, formatDate } from '@/utils/format';
import {
  buildCashFlowFromTransactions,
  buildContributionTrend,
  buildSnapshotFromBalance,
  sumMonthlyFlows,
} from '@/services/treasury';
import {
  apiCreateTransaction,
  apiListTransactions,
  apiCreateCooperative,
  type TxType,
} from '@/services/notifications/api';
import { applyWalletContribution } from '@/services/cooperative/members';
import {
  loadLoans,
  outstandingLoansTotal,
  totalDisbursedAmount,
} from '@/services/cooperative/loans';
import type { CashFlowPoint, Loan } from '@/types';
import { Link } from 'wouter';
import { OnChainVaultPanel } from '@/components/treasury/OnChainVaultPanel';
import {
  fetchVaultSnapshot,
  isVaultConfigured,
} from '@/services/treasury/vault';

/** Only ledger rows that came from a real Arc vault deposit (never invent cash). */
function isOnChainLedgerTx(row: { note?: string; type?: string }): boolean {
  const note = (row.note ?? '').toLowerCase();
  return note.includes('on-chain') || note.includes('arc vault');
}

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

type TxRow = {
  id: string;
  type: TxType;
  amount: number;
  currency: string;
  note?: string;
  createdAt: string;
  walletIdentity: string;
};

export default function Treasury() {
  const { walletAddress } = useWallet();
  const { activeCooperative, updateCooperative } = useCooperative();
  const [totalBalance, setTotalBalance] = useState(activeCooperative?.treasuryBalance ?? 0);
  const [monthlyInflow, setMonthlyInflow] = useState(0);
  const [monthlyOutflow, setMonthlyOutflow] = useState(0);
  const [txns, setTxns] = useState<TxRow[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowPoint[]>([]);
  const [contributionTrend, setContributionTrend] = useState<Array<{ label: string; value: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);

  const reloadLoans = useCallback(() => {
    if (!activeCooperative) {
      setLoans([]);
      return;
    }
    setLoans(loadLoans(activeCooperative.id));
  }, [activeCooperative]);

  useEffect(() => {
    reloadLoans();
  }, [reloadLoans]);

  useEffect(() => {
    const onLoans = (ev: Event) => {
      const id = (ev as CustomEvent<{ cooperativeId?: string }>).detail?.cooperativeId;
      if (!activeCooperative || (id && id !== activeCooperative.id)) return;
      reloadLoans();
    };
    window.addEventListener('nexusu:loans-updated', onLoans);
    return () => window.removeEventListener('nexusu:loans-updated', onLoans);
  }, [activeCooperative, reloadLoans]);

  const loansOutstanding = outstandingLoansTotal(loans);
  const loansDisbursed = totalDisbursedAmount(loans);
  const totalEconomic = totalBalance + loansOutstanding;
  const deployedPct =
    totalEconomic > 0
      ? Math.min(100, Math.round((loansOutstanding / totalEconomic) * 100))
      : 0;

  const disbursedLoans = useMemo(
    () =>
      loans.filter(
        (l) =>
          l.status === 'approved' ||
          l.status === 'active' ||
          l.status === 'completed',
      ),
    [loans],
  );

  const allocation = useMemo(
    () => buildSnapshotFromBalance(totalBalance, monthlyInflow, monthlyOutflow),
    [totalBalance, monthlyInflow, monthlyOutflow],
  );
  const currency = activeCooperative?.currency ?? 'USD';

  const ensureBackendCoop = useCallback(async (wallet: string) => {
    if (!activeCooperative) throw new Error('Select or create a cooperative first');
    // Prefer invite code so local + server stay linked even when IDs differ
    if (activeCooperative.inviteCode) {
      return { inviteCode: activeCooperative.inviteCode, coopId: activeCooperative.id };
    }
    // Seed backend from local coop if never synced
    await apiCreateCooperative(wallet, {
      name: activeCooperative.name,
      description: activeCooperative.description,
      type: activeCooperative.type,
      country: activeCooperative.country,
      currency: activeCooperative.currency,
      contributionAmount: activeCooperative.contributionAmount,
      contributionFrequency: activeCooperative.contributionFrequency,
      inviteCode: activeCooperative.inviteCode ?? `SYNC-${Date.now().toString(36).toUpperCase()}`,
    });
    return {
      inviteCode: activeCooperative.inviteCode,
      coopId: activeCooperative.id,
    };
  }, [activeCooperative]);

  const refresh = useCallback(async () => {
    if (!activeCooperative) return;
    setError(null);

    // Source of truth: on-chain vault when configured (never show offline ledger as cash)
    let balance = 0;
    if (isVaultConfigured()) {
      try {
        const snap = await fetchVaultSnapshot(walletAddress);
        balance = snap.totalBalance;
        // Keep coop cache aligned so Overview / other pages don't show stale ledger cash
        if ((activeCooperative.treasuryBalance ?? 0) !== balance) {
          updateCooperative(activeCooperative.id, { treasuryBalance: balance });
        }
      } catch {
        balance = 0;
      }
    } else {
      balance = activeCooperative.treasuryBalance ?? 0;
    }
    setTotalBalance(balance);

    if (!walletAddress) {
      setTxns([]);
      setMonthlyInflow(0);
      setMonthlyOutflow(0);
      setCashFlow(
        balance > 0
          ? [{
              month: new Date().toLocaleDateString('en-US', { month: 'short' }),
              inflow: 0,
              outflow: 0,
              balance,
            }]
          : [],
      );
      setContributionTrend([]);
      return;
    }

    try {
      await ensureBackendCoop(walletAddress).catch(() => null);
      const list = await apiListTransactions(walletAddress, {
        coopId: activeCooperative.id,
        limit: 100,
      }).catch(() => ({ transactions: [] as TxRow[] }));
      let rows = (list.transactions ?? []) as TxRow[];
      // With vault live: only count real Arc deposit mirrors — drop phantom ledger cash
      if (isVaultConfigured()) {
        rows = rows.filter(isOnChainLedgerTx);
      }
      setTxns(rows);
      const flows = sumMonthlyFlows(rows);
      setMonthlyInflow(flows.monthlyInflow);
      setMonthlyOutflow(flows.monthlyOutflow);
      setCashFlow(
        balance > 0 || rows.length > 0
          ? buildCashFlowFromTransactions(rows, balance)
          : [],
      );
      setContributionTrend(
        rows.length > 0 ? buildContributionTrend(rows) : [],
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh treasury');
    }
  }, [walletAddress, activeCooperative, ensureBackendCoop, updateCooperative]);

  useEffect(() => {
    void refresh();
  }, [activeCooperative?.id, refresh]);

  /**
   * After a successful Arc deposit, mirror the contribution into the app ledger
   * (members totals, notifications, charts). Never invent amounts — uses on-chain value.
   */
  const recordOnChainDeposit = useCallback(
    async (value: number) => {
      if (!walletAddress || !activeCooperative || !Number.isFinite(value) || value <= 0) {
        return;
      }
      setError(null);
      try {
        let inviteCode = activeCooperative.inviteCode;
        if (!inviteCode) {
          const res = await apiCreateCooperative(walletAddress, {
            name: activeCooperative.name,
            description: activeCooperative.description,
            type: activeCooperative.type,
            country: activeCooperative.country,
            currency: activeCooperative.currency,
            contributionAmount: activeCooperative.contributionAmount,
            contributionFrequency: activeCooperative.contributionFrequency,
          });
          inviteCode = String(res.cooperative.inviteCode);
          updateCooperative(activeCooperative.id, { inviteCode });
        } else {
          await apiCreateCooperative(walletAddress, {
            name: activeCooperative.name,
            description: activeCooperative.description,
            type: activeCooperative.type,
            country: activeCooperative.country,
            currency: activeCooperative.currency,
            contributionAmount: activeCooperative.contributionAmount,
            contributionFrequency: activeCooperative.contributionFrequency,
            inviteCode,
          }).catch(() => null);
        }

        let result;
        try {
          result = await apiCreateTransaction(walletAddress, {
            inviteCode,
            type: 'contribution',
            amount: value,
            note: 'On-chain Arc vault deposit',
          });
        } catch (firstErr) {
          const { apiJoinCooperative } = await import('@/services/notifications/api');
          await apiJoinCooperative(walletAddress, inviteCode!).catch(() => null);
          result = await apiCreateTransaction(walletAddress, {
            inviteCode,
            type: 'contribution',
            amount: value,
            note: 'On-chain Arc vault deposit',
          }).catch(() => {
            throw firstErr;
          });
        }

        const snap = result.snapshot as Record<string, number> | null;
        const nextTotal =
          typeof snap?.totalBalance === 'number' ? snap.totalBalance : totalBalance + value;

        setTotalBalance(nextTotal);
        if (typeof snap?.monthlyInflow === 'number') setMonthlyInflow(snap.monthlyInflow);
        if (typeof snap?.monthlyOutflow === 'number') setMonthlyOutflow(snap.monthlyOutflow);

        const serverCoopId =
          typeof result.transaction.coopId === 'string' ? result.transaction.coopId : undefined;

        updateCooperative(activeCooperative.id, {
          treasuryBalance: nextTotal,
          ...(serverCoopId ? { backendId: serverCoopId } : {}),
        });

        applyWalletContribution(activeCooperative.id, walletAddress, value);

        setTxns((prev) => [
          {
            id: result.transaction.id,
            type: result.transaction.type,
            amount: result.transaction.amount,
            currency: String(
              result.transaction.currency ?? activeCooperative.currency ?? 'USD',
            ),
            note: 'On-chain Arc vault deposit',
            createdAt: result.transaction.createdAt,
            walletIdentity: walletAddress,
          },
          ...prev,
        ]);

        void refresh();
        setSuccess(
          `On-chain deposit of ${formatCurrency(value)} recorded for members & notifications.`,
        );
      } catch (e) {
        // On-chain already succeeded — don't block user, just note ledger lag
        console.warn('[Treasury] ledger mirror failed after on-chain deposit', e);
        setSuccess(
          `On-chain deposit of ${formatCurrency(value)} submitted. Ledger sync may lag — refresh shortly.`,
        );
      }
    },
    [walletAddress, activeCooperative, totalBalance, updateCooperative, refresh],
  );

  const coopLabel = activeCooperative?.name ?? 'No cooperative selected';

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 py-5 sm:py-6 max-w-7xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-7"
        >
          <div className="min-w-0">
            <h1 className="text-xl font-display font-bold text-stone-900 dark:text-white">Treasury</h1>
            <p className="text-sm text-stone-400 dark:text-white/40 mt-0.5 break-words">
              {coopLabel}
            </p>
          </div>
          <button
            onClick={() => void refresh()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl border border-stone-200 dark:border-white/10 text-sm text-stone-500 dark:text-white/50 hover:border-stone-300 dark:hover:border-white/20 transition-colors w-full sm:w-auto flex-shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </motion.div>

        {/* Primary path: on-chain deposit (founder rules enforced by vault) */}
        <OnChainVaultPanel
          onDepositSuccess={({ amount: deposited }) => recordOnChainDeposit(deposited)}
        />

        {(error || success) && (
          <div className="mb-6">
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            {success && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>
            )}
          </div>
        )}

        {/* Total balance hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-gradient-to-br from-[#6393C4] to-[#77A6DB] rounded-2xl p-5 sm:p-7 mb-6 text-white relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)' }} />
          <p className="text-sm font-medium text-white/70 mb-2">
            Cash on hand
          </p>
          <p className="text-3xl sm:text-5xl font-display font-bold mb-1 tabular-nums break-all">
            {formatCurrency(totalBalance)}
          </p>
          <div className="flex items-center gap-2 text-sm text-white/80">
            <TrendingUp className="w-4 h-4" />
            <span>
              Net deposits this month: {formatCurrency(monthlyInflow - monthlyOutflow)}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-white/20">
            <div>
              <p className="text-white/60 text-xs mb-1">Monthly Inflow</p>
              <div className="flex items-center gap-1">
                <ArrowUpRight className="w-4 h-4 text-white" />
                <span className="text-lg font-bold">{formatCurrency(monthlyInflow)}</span>
              </div>
            </div>
            <div>
              <p className="text-white/60 text-xs mb-1">Monthly Outflow</p>
              <div className="flex items-center gap-1">
                <ArrowDownRight className="w-4 h-4 text-white/70" />
                <span className="text-lg font-bold text-white/80">{formatCurrency(monthlyOutflow)}</span>
              </div>
            </div>
            <div>
              <p className="text-white/60 text-xs mb-1">Outstanding loans</p>
              <span className="text-lg font-bold">{formatCurrency(loansOutstanding)}</span>
            </div>
            <div>
              <p className="text-white/60 text-xs mb-1">Cash + loans</p>
              <span className="text-lg font-bold">
                {formatCurrency(totalBalance + loansOutstanding)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Treasury allocation breakdown — policy split of cash on hand */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mb-6"
        >
          <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-stone-800 dark:text-white">
              Treasury allocation
            </h2>
            <p className="text-xs font-medium text-stone-500 dark:text-white/45">
              {formatCurrency(totalBalance, currency)}
            </p>
          </div>

          {/* Stacked bar */}
          <div className="h-3 rounded-full overflow-hidden flex mb-4 bg-stone-100 dark:bg-white/8">
            <div className="h-full bg-emerald-500" style={{ width: '60%' }} title="Rotation Fund 60%" />
            <div className="h-full bg-[#6393C4]" style={{ width: '30%' }} title="Loan Pool 30%" />
            <div className="h-full bg-amber-500" style={{ width: '5%' }} title="Emergency Reserve 5%" />
            <div className="h-full bg-purple-500" style={{ width: '5%' }} title="Savings / Investments 5%" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <TreasuryCard
              label="Rotation Fund · 60%"
              value={allocation.rotationFund}
              color="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              icon={RotateCcw}
              delay={0.1}
            />
            <TreasuryCard
              label="Loan Pool · 30%"
              value={allocation.loanPool}
              color="bg-[#6393C4]/8 dark:bg-[#6393C4]/10 text-[#5289B8] dark:text-[#77A6DB]"
              icon={Banknote}
              delay={0.15}
            />
            <TreasuryCard
              label="Emergency Reserve · 5%"
              value={allocation.emergencyReserve}
              color="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
              icon={Shield}
              delay={0.2}
            />
            <TreasuryCard
              label="Savings / Investments · 5%"
              value={allocation.savingsInvestment}
              color="bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400"
              icon={PiggyBank}
              delay={0.25}
            />
          </div>
        </motion.div>

        {/* Loan portfolio */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5 mb-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <h2 className="text-sm font-semibold text-stone-800 dark:text-white">Loan portfolio</h2>
            <Link
              href="/dashboard/loans"
              className="text-xs font-semibold text-[#6393C4] hover:underline"
            >
              Manage loans
            </Link>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl bg-stone-50 dark:bg-[#2E3B4B]/35 border border-stone-100 dark:border-white/6 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-white/35">Disbursed</p>
              <p className="text-base font-display font-bold text-stone-800 dark:text-white mt-0.5">
                {formatCurrency(loansDisbursed, currency)}
              </p>
            </div>
            <div className="rounded-xl bg-stone-50 dark:bg-[#2E3B4B]/35 border border-stone-100 dark:border-white/6 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-white/35">Outstanding</p>
              <p className="text-base font-display font-bold text-stone-800 dark:text-white mt-0.5">
                {formatCurrency(loansOutstanding, currency)}
              </p>
            </div>
            <div className="rounded-xl bg-stone-50 dark:bg-[#2E3B4B]/35 border border-stone-100 dark:border-white/6 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-white/35">Cash on hand</p>
              <p className="text-base font-display font-bold text-stone-800 dark:text-white mt-0.5">
                {formatCurrency(totalBalance, currency)}
              </p>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="text-stone-400 dark:text-white/40 font-medium">
                Outstanding share
              </span>
              <span className="font-semibold text-stone-600 dark:text-white/60">{deployedPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-stone-100 dark:bg-white/8 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#6393C4] to-[#77A6DB] transition-all"
                style={{ width: `${deployedPct}%` }}
              />
            </div>
          </div>

          {disbursedLoans.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-stone-200 dark:border-white/10 rounded-xl">
              <Banknote className="w-8 h-8 text-stone-200 dark:text-white/10 mx-auto mb-2" />
              <p className="text-sm text-stone-500 dark:text-white/45 font-medium">No loans yet</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto rounded-xl border border-stone-100 dark:border-[#1A2A3A]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 dark:border-[#1A2A3A] bg-stone-50/80 dark:bg-[#2E3B4B]/25">
                      {['Member', 'Amount', 'Purpose', 'Term', 'Status', 'Granted'].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-[10px] font-semibold text-stone-400 dark:text-white/30 uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {disbursedLoans.map((loan) => (
                      <tr
                        key={loan.id}
                        className="border-b border-stone-50 dark:border-white/4 last:border-0"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#6393C4] to-[#77A6DB] flex items-center justify-center text-white text-[10px] font-bold">
                              {loan.borrowerInitials}
                            </div>
                            <div>
                              <p className="font-medium text-stone-800 dark:text-white text-sm">
                                {loan.borrowerName}
                              </p>
                              {loan.borrowerWallet && (
                                <p className="text-[10px] font-mono text-stone-400 dark:text-white/30">
                                  {loan.borrowerWallet.slice(0, 6)}…{loan.borrowerWallet.slice(-4)}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-stone-800 dark:text-white">
                          {formatCurrency(loan.approvedAmount ?? loan.requestedAmount, currency)}
                        </td>
                        <td className="px-4 py-3 text-stone-600 dark:text-white/60">
                          {loan.purposeCategory ?? loan.purpose}
                        </td>
                        <td className="px-4 py-3 text-stone-600 dark:text-white/60">
                          {loan.repaymentMonths} mo
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            {loan.status === 'approved' ? 'Disbursed' : loan.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-stone-400 dark:text-white/40 whitespace-nowrap">
                          {formatDate(loan.requestedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-2">
                {disbursedLoans.map((loan) => (
                  <div
                    key={loan.id}
                    className="flex items-center gap-3 rounded-xl border border-stone-100 dark:border-white/8 bg-stone-50/50 dark:bg-[#2E3B4B]/25 px-3 py-3"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#6393C4] to-[#77A6DB] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {loan.borrowerInitials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-stone-800 dark:text-white truncate">
                        {loan.borrowerName}
                      </p>
                      <p className="text-[11px] text-stone-400 dark:text-white/35 truncate">
                        {loan.purposeCategory ?? loan.purpose} · {loan.repaymentMonths} mo · {formatDate(loan.requestedAt)}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-stone-800 dark:text-white flex-shrink-0">
                      {formatCurrency(loan.approvedAmount ?? loan.requestedAmount, currency)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>

        {/* Charts from live ledger aggregates (details live under Notifications) */}
        <div className="grid lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2 bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5"
          >
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-stone-800 dark:text-white">Cash Flow</h2>
            </div>
            {cashFlow.length === 0 ? (
              <div className="h-[260px] flex flex-col items-center justify-center text-center">
                <Vault className="w-8 h-8 text-stone-200 dark:text-white/10 mb-2" />
                <p className="text-sm text-stone-400 dark:text-white/40">No cash-flow history yet</p>
              </div>
            ) : (
              <AreaChart
                data={cashFlow}
                xKey="month"
                areas={[
                  { key: 'balance', label: 'Balance', color: '#6393C4' },
                  { key: 'inflow', label: 'Inflow', color: '#10b981' },
                  { key: 'outflow', label: 'Outflow', color: '#f59e0b' },
                ]}
                height={260}
                formatY={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${Math.round(v)}`)}
              />
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5"
          >
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-stone-800 dark:text-white">Contribution Trend</h2>
            </div>
            {contributionTrend.length === 0 || contributionTrend.every((p) => p.value === 0) ? (
              <div className="h-[260px] flex flex-col items-center justify-center text-center">
                <p className="text-sm text-stone-400 dark:text-white/40">No contributions recorded</p>
              </div>
            ) : (
              <BarChart
                data={contributionTrend}
                xKey="label"
                bars={[{ key: 'value', color: '#6393C4', label: 'Contributions' }]}
                height={260}
                formatY={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${Math.round(v)}`)}
              />
            )}
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}

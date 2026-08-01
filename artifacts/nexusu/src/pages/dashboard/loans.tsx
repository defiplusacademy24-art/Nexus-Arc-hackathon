import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Banknote, Clock, CheckCircle2, XCircle, TrendingUp, Sparkles,
  Loader2, Shield, AlertTriangle, RefreshCcw, ArrowDownToLine,
  Download,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { useCooperative } from '@/providers/CooperativeProvider';
import { useWallet } from '@/providers/WalletProvider';
import {
  loadLoans,
  outstandingLoansTotal,
  totalDisbursedAmount,
  pendingReviewCount,
  activeLoansCount,
  repaymentRate,
  createLoanAndNotify,
  remainingBalance,
  applyLoanRepayment,
  isOutstandingLoan,
  ensureLoanFinance,
} from '@/services/cooperative/loans';
import {
  evaluateLoanApplication,
  decisionBadgeLabel,
} from '@/services/cooperative/lending-agent';
import {
  LOAN_INTEREST_TABLE,
  computeLoanFinance,
  formatInterestPct,
} from '@/services/cooperative/interest';
import { getMemberByWallet, loadMembersInPayoutOrder } from '@/services/cooperative/members';
import {
  applyForLoanOnChain,
  approveLoanOnChain,
  fetchOnChainLoans,
  fetchPoolSnapshot,
  friendlyLoanError,
  fundPoolOnChain,
  isLoanPoolConfigured,
  onChainLoanIdFromAppId,
  registerBorrowerOnChain,
  rejectLoanOnChain,
  repayLoanOnChain,
  type PoolSnapshot,
} from '@/services/loan/pool';
import {
  fetchVaultSnapshot,
  isVaultConfigured,
} from '@/services/treasury/vault';
import { formatCurrency, formatDate, riskColor, riskLabel } from '@/utils/format';
import { cn } from '@/lib/utils';
import type {
  AiLoanAssessment,
  Loan,
  LoanPurposeCategory,
  LoanStatus,
  Member,
} from '@/types';

const PURPOSES: LoanPurposeCategory[] = [
  'Business',
  'Education',
  'Emergency',
  'Medical',
  'Agriculture',
  'Personal',
  'Other',
];

const PERIODS = LOAN_INTEREST_TABLE.map((r) => ({
  months: r.months,
  label: r.label,
}));

type DistLogLine = {
  id: string;
  label: string;
  amount: number;
  tone: 'principal' | 'interest' | 'treasury' | 'savings';
};

const STATUS_CONFIG: Record<LoanStatus, { label: string; class: string; icon: React.ElementType }> = {
  pending: {
    label: 'Pending Governance',
    class: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
    icon: Clock,
  },
  approved: {
    label: 'Approved',
    class: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
    icon: CheckCircle2,
  },
  active: {
    label: 'Active',
    class: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
    icon: TrendingUp,
  },
  rejected: {
    label: 'Declined',
    class: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',
    icon: XCircle,
  },
  completed: {
    label: 'Completed',
    class: 'bg-stone-50 dark:bg-[#2E3B4B]/40 text-stone-500 dark:text-white/40 border-stone-200 dark:border-white/10',
    icon: CheckCircle2,
  },
  defaulted: {
    label: 'Defaulted',
    class: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',
    icon: XCircle,
  },
};

function Avatar({ initials }: { initials: string }) {
  const cols = [
    'from-[#6393C4] to-[#77A6DB]',
    'from-purple-500 to-pink-500',
    'from-blue-500 to-cyan-500',
    'from-teal-500 to-emerald-500',
    'from-[#5289B8] to-[#6393C4]',
  ];
  return (
    <div
      className={cn(
        'w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold flex-shrink-0',
        cols[initials.charCodeAt(0) % cols.length],
      )}
    >
      {initials}
    </div>
  );
}

function DecisionBadge({ decision }: { decision: AiLoanAssessment['decision'] }) {
  const map = {
    APPROVED: {
      label: 'APPROVED',
      class: 'bg-emerald-500 text-white border-emerald-600',
    },
    REQUIRES_GOVERNANCE_REVIEW: {
      label: 'REQUIRES GOVERNANCE REVIEW',
      class: 'bg-amber-400 text-amber-950 border-amber-500',
    },
    DECLINED: {
      label: 'DECLINED',
      class: 'bg-red-500 text-white border-red-600',
    },
  } as const;
  const cfg = map[decision];
  return (
    <span
      className={cn(
        'inline-flex items-center max-w-full px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-bold tracking-wide border text-center leading-tight',
        cfg.class,
      )}
    >
      {cfg.label}
    </span>
  );
}

function MetricPill({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
}) {
  const tones = {
    good: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/80 dark:border-emerald-500/20',
    warn: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200/80 dark:border-amber-500/20',
    bad: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200/80 dark:border-red-500/20',
    neutral: 'text-stone-700 dark:text-white/80 bg-stone-50 dark:bg-[#2E3B4B]/40 border-stone-200 dark:border-white/10',
  };
  return (
    <div className={cn('rounded-xl border px-3 py-2.5', tones[tone])}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mb-0.5">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

function ScoreBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color =
    pct >= 85 ? 'bg-emerald-400' : pct >= 60 ? 'bg-[#77A6DB]' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-stone-500 dark:text-white/45 font-medium">{label}</span>
        <span className="font-bold text-stone-800 dark:text-white">{value}/{max}</span>
      </div>
      <div className="h-2 rounded-full bg-stone-100 dark:bg-white/8 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn('h-full rounded-full', color)}
        />
      </div>
    </div>
  );
}

function AiEvaluationCard({
  assessment,
  currency,
}: {
  assessment: AiLoanAssessment;
  currency: string;
}) {
  const histTone =
    assessment.contributionHistory === 'Excellent' || assessment.contributionHistory === 'Good'
      ? 'good'
      : assessment.contributionHistory === 'Average'
        ? 'warn'
        : 'bad';
  const treasTone =
    assessment.treasuryHealth === 'Healthy'
      ? 'good'
      : assessment.treasuryHealth === 'Moderate'
        ? 'warn'
        : 'bad';
  const liqTone = assessment.loanPoolLiquidity === 'Enough liquidity' ? 'good' : 'warn';
  const riskTone =
    assessment.riskLevel === 'Low' ? 'good' : assessment.riskLevel === 'Medium' ? 'warn' : 'bad';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[#6393C4]/25 dark:border-[#6393C4]/30 bg-gradient-to-br from-white via-white to-[#6393C4]/5 dark:from-stone-900/80 dark:via-stone-900/60 dark:to-[#6393C4]/10 p-5 sm:p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6393C4] to-[#77A6DB] flex items-center justify-center shadow-md shadow-[#6393C4]/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-display font-bold text-stone-900 dark:text-white text-base">
              AI Assessment
            </h3>
          </div>
        </div>
        <DecisionBadge decision={assessment.decision} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-5">
        <MetricPill label="Contribution History" value={assessment.contributionHistory} tone={histTone} />
        <MetricPill
          label="Member Reputation"
          value={`${assessment.memberReputation}/100`}
          tone={assessment.memberReputation >= 85 ? 'good' : assessment.memberReputation >= 60 ? 'warn' : 'bad'}
        />
        <MetricPill label="Treasury Health" value={assessment.treasuryHealth} tone={treasTone} />
        <MetricPill label="Loan Pool Liquidity" value={assessment.loanPoolLiquidity} tone={liqTone} />
        <MetricPill label="Existing Outstanding Loans" value={assessment.outstandingLoansLabel} />
        <MetricPill
          label="Requested Amount"
          value={formatCurrency(assessment.requestedAmount, currency)}
        />
        <MetricPill label="Risk Level" value={assessment.riskLevel} tone={riskTone} />
        <MetricPill
          label="Repayment Forecast"
          value={`${assessment.repaymentForecast}%`}
          tone={assessment.repaymentForecast >= 80 ? 'good' : 'warn'}
        />
        <MetricPill
          label="Max Allowed (policy)"
          value={formatCurrency(assessment.maxAllowedAmount, currency)}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-5">
        <ScoreBar label="Reputation score" value={assessment.memberReputation} />
        <ScoreBar label="Risk score (lower is safer)" value={assessment.riskScore} />
      </div>

      <div className="rounded-xl border border-stone-100 dark:border-white/8 bg-stone-50/80 dark:bg-[#2E3B4B]/30 px-4 py-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Shield className="w-3.5 h-3.5 text-[#6393C4]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6393C4]">
            Agent explanation
          </span>
        </div>
        <p className="text-sm text-stone-600 dark:text-white/70 leading-relaxed">
          {assessment.explanation}
        </p>
      </div>

      {assessment.decision === 'APPROVED' && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3 py-1.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5289B8] dark:text-[#77A6DB] bg-[#6393C4]/10 border border-[#6393C4]/20 px-3 py-1.5 rounded-full">
            <Banknote className="w-3.5 h-3.5" />
            Disbursement Ready
          </span>
        </div>
      )}
    </motion.div>
  );
}

function LoanCard({
  loan,
  currency,
  canApprove,
  busyId,
  onApprove,
  onReject,
}: {
  loan: Loan;
  currency: string;
  canApprove?: boolean;
  busyId?: string | null;
  onApprove?: (loan: Loan) => void;
  onReject?: (loan: Loan) => void;
}) {
  const config = STATUS_CONFIG[loan.status];
  const Icon = config.icon;
  const L = ensureLoanFinance(loan);
  const statusLabel =
    loan.aiDecision ? decisionBadgeLabel(loan.aiDecision) : config.label;
  const principal = L.approvedAmount ?? L.requestedAmount;
  const totalDue = L.totalRepayment ?? principal;
  const paid = L.paidAmount ?? 0;
  const remaining = remainingBalance(L);
  const progress =
    totalDue > 0 ? Math.round((paid / totalDue) * 100) : undefined;
  const ratePct = formatInterestPct(L.interestRate ?? 0.05);
  const isOnChain = Boolean(onChainLoanIdFromAppId(loan.id));
  const busy = busyId === loan.id;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5 hover:shadow-md dark:hover:border-white/10 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-4 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar initials={loan.borrowerInitials} />
          <div className="min-w-0">
            <p className="font-semibold text-stone-800 dark:text-white text-sm truncate">{loan.borrowerName}</p>
            <p className="text-xs text-stone-400 dark:text-white/40">{formatDate(loan.requestedAt)}</p>
          </div>
        </div>
        <span
          className={cn(
            'flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold px-2 py-1 rounded-full border flex-shrink-0 max-w-[45%] sm:max-w-none',
            config.class,
          )}
        >
          <Icon className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{statusLabel}</span>
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-3 flex-wrap">
        <span className="text-2xl font-display font-bold text-stone-900 dark:text-white">
          {formatCurrency(principal, currency)}
        </span>
        {loan.status === 'pending' && (
          <span className="text-xs text-stone-400 dark:text-white/40">requested</span>
        )}
        {isOutstandingLoan(loan) && (
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            {formatCurrency(remaining, currency)} remaining
          </span>
        )}
        {loan.status === 'completed' && (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            Fully repaid
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
        <div className="bg-stone-50 dark:bg-[#2E3B4B]/35 rounded-lg px-2.5 py-2">
          <p className="text-[10px] text-stone-400 dark:text-white/30 mb-0.5">Purpose</p>
          <p className="font-semibold text-stone-800 dark:text-white">{loan.purposeCategory ?? loan.purpose}</p>
        </div>
        <div className="bg-stone-50 dark:bg-[#2E3B4B]/35 rounded-lg px-2.5 py-2">
          <p className="text-[10px] text-stone-400 dark:text-white/30 mb-0.5">Duration</p>
          <p className="font-semibold text-stone-800 dark:text-white">{loan.repaymentMonths} mo</p>
        </div>
        <div className="bg-stone-50 dark:bg-[#2E3B4B]/35 rounded-lg px-2.5 py-2">
          <p className="text-[10px] text-stone-400 dark:text-white/30 mb-0.5">Interest</p>
          <p className="font-semibold text-stone-800 dark:text-white">{ratePct}</p>
        </div>
        <div className="bg-stone-50 dark:bg-[#2E3B4B]/35 rounded-lg px-2.5 py-2">
          <p className="text-[10px] text-stone-400 dark:text-white/30 mb-0.5">Monthly</p>
          <p className="font-semibold text-stone-800 dark:text-white">
            {formatCurrency(L.monthlyPayment, currency)}
          </p>
        </div>
      </div>

      {progress !== undefined && (paid > 0 || isOutstandingLoan(loan)) && totalDue > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-stone-400 dark:text-white/40">Repayment progress</span>
            <span className="font-semibold text-stone-700 dark:text-white/80">
              {formatCurrency(paid, currency)} / {formatCurrency(totalDue, currency)}
            </span>
          </div>
          <div className="h-2 bg-stone-100 dark:bg-white/8 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          {loan.dueDate && isOutstandingLoan(loan) && (
            <p className="text-[10px] text-stone-400 dark:text-white/30 mt-1">
              Due {formatDate(loan.dueDate)} · Total with interest {formatCurrency(totalDue, currency)}
            </p>
          )}
        </div>
      )}

      {loan.disbursementReady && loan.status === 'approved' && (
        <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mb-2">
          <CheckCircle2 className="w-3.5 h-3.5" /> Disbursement Ready
        </div>
      )}

      {isOnChain && (
        <p className="text-[10px] font-semibold text-[#6393C4] mb-2 flex items-center gap-1">
          <Shield className="w-3 h-3" /> On-chain · {loan.id}
        </p>
      )}

      {canApprove && loan.status === 'pending' && isOnChain && (
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => onApprove?.(loan)}
            className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy ? '…' : 'Approve & disburse'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onReject?.(loan)}
            className="flex-1 py-2 rounded-xl border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      )}

      {loan.aiRecommendation && (
        <div className="bg-[#6393C4]/5 dark:bg-[#6393C4]/8 border border-[#6393C4]/12 rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3 h-3 text-[#6393C4]" />
            <span className="text-[10px] font-semibold text-[#6393C4] uppercase tracking-wide">
              {isOnChain ? 'On-chain pool' : 'AI Lending Agent'}
            </span>
          </div>
          <p className="text-xs text-stone-600 dark:text-white/60 leading-relaxed line-clamp-3">
            {loan.aiRecommendation}
          </p>
        </div>
      )}
    </motion.div>
  );
}

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected' | 'active' | 'completed';

type FormState = {
  amount: string;
  purpose: LoanPurposeCategory | '';
  months: number;
  reason: string;
  agreed: boolean;
};

const EMPTY_FORM: FormState = {
  amount: '',
  purpose: '',
  months: 3,
  reason: '',
  agreed: false,
};

/**
 * `approveLoan` enforces both that the principal is available and that it is
 * no more than `maxLoanBps` of the pool. This is the smallest pool balance
 * that can approve a particular principal (before any concurrent approvals).
 */
function minimumPoolLiquidityForLoan(principal: number, maxLoanBps: number): number {
  if (!Number.isFinite(principal) || principal <= 0 || maxLoanBps <= 0) return 0;
  return Math.ceil(((principal * 10_000) / maxLoanBps) * 1_000_000) / 1_000_000;
}

function nextPaymentEstimate(loan: Loan): number {
  const L = ensureLoanFinance(loan);
  const rem = remainingBalance(L);
  return Math.min(rem, L.monthlyPayment || rem);
}

export default function Loans() {
  const { activeCooperative, updateCooperative, refresh } = useCooperative();
  const { walletAddress, identity, isConnected } = useWallet();
  const onChainMode = isLoanPoolConfigured();
  const vaultMode = isVaultConfigured();
  const [tab, setTab] = useState<FilterTab>('all');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [poolSnap, setPoolSnap] = useState<PoolSnapshot | null>(null);
  const [vaultBalance, setVaultBalance] = useState<number | null>(null);
  const [loadingChain, setLoadingChain] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [assessment, setAssessment] = useState<AiLoanAssessment | null>(null);
  const [lastCreated, setLastCreated] = useState<Loan | null>(null);
  const [showRepay, setShowRepay] = useState(false);
  const [repayLoanId, setRepayLoanId] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  const [repayError, setRepayError] = useState('');
  const [repaySuccess, setRepaySuccess] = useState('');
  const [repaying, setRepaying] = useState(false);
  const [distLog, setDistLog] = useState<DistLogLine[]>([]);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [fundAmount, setFundAmount] = useState('');
  const [fundBusy, setFundBusy] = useState(false);
  const [chainMsg, setChainMsg] = useState<string | null>(null);
  const [poolError, setPoolError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!activeCooperative) {
      setLoans([]);
      setPoolSnap(null);
      setVaultBalance(null);
      return;
    }

    if (onChainMode) {
      setLoadingChain(true);
      try {
        const members = loadMembersInPayoutOrder(activeCooperative.id);
        const nameByWallet: Record<string, string> = {};
        for (const m of members) {
          if (m.walletIdentity) {
            nameByWallet[m.walletIdentity.toLowerCase()] = m.name;
          }
        }
        const [snap, chainLoans, vault] = await Promise.all([
          fetchPoolSnapshot(walletAddress),
          fetchOnChainLoans({ nameByWallet }),
          vaultMode ? fetchVaultSnapshot().catch(() => null) : Promise.resolve(null),
        ]);
        setPoolSnap(snap);
        setLoans(chainLoans);
        setVaultBalance(vault?.totalBalance ?? null);
      } catch (e) {
        setPoolError(friendlyLoanError(e));
        setLoans([]);
        setVaultBalance(null);
      } finally {
        setLoadingChain(false);
      }
      return;
    }

    setLoans(loadLoans(activeCooperative.id));
    setPoolSnap(null);
    if (vaultMode) {
      try {
        const vault = await fetchVaultSnapshot();
        setVaultBalance(vault.totalBalance);
      } catch {
        setVaultBalance(null);
      }
    } else {
      setVaultBalance(null);
    }
  }, [activeCooperative, onChainMode, vaultMode, walletAddress]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onUpd = (ev: Event) => {
      const id = (ev as CustomEvent<{ cooperativeId?: string }>).detail?.cooperativeId;
      if (!activeCooperative || (id && id !== activeCooperative.id)) return;
      void reload();
    };
    window.addEventListener('nexusu:loans-updated', onUpd);
    return () => window.removeEventListener('nexusu:loans-updated', onUpd);
  }, [activeCooperative, reload]);

  const applicant: Member | null = useMemo(() => {
    if (!activeCooperative || !walletAddress) return null;
    return (
      getMemberByWallet(activeCooperative.id, walletAddress) ??
      loadMembersInPayoutOrder(activeCooperative.id).find(
        (m) => m.walletIdentity.toLowerCase() === walletAddress.toLowerCase(),
      ) ??
      null
    );
  }, [activeCooperative, walletAddress]);

  const currency = activeCooperative?.currency ?? 'USD';
  const outstanding = outstandingLoansTotal(loans);
  const disbursed = totalDisbursedAmount(loans);
  const pendingN = pendingReviewCount(loans);
  const activeN = activeLoansCount(loans);
  const repayRate = repaymentRate(loans);
  // The deployed treasury vault is the source of truth when available.
  // Do not briefly substitute the local cache while that on-chain value loads.
  const treasuryBalance = vaultMode
    ? (vaultBalance ?? 0)
    : (activeCooperative?.treasuryBalance ?? 0);
  const treasuryLoanPool = Math.round(
    treasuryBalance * 0.3 * 100,
  ) / 100;
  // A request does not reserve capital. Capacity is consumed only when the
  // organizer approves and the principal is actually disbursed on-chain.
  const deployedPrincipal = onChainMode
    ? (poolSnap?.outstandingPrincipal ?? 0)
    : outstanding;
  const treasuryLoanAvailable = Math.max(
    0,
    Math.round((treasuryLoanPool - deployedPrincipal) * 100) / 100,
  );
  const poolLiquidity = poolSnap?.liquidity ?? 0;
  const maxLoanBps = poolSnap?.maxLoanBps ?? 2500;
  const poolApprovalCapacity = Math.floor((poolLiquidity * maxLoanBps) / 10_000 * 1_000_000) / 1_000_000;
  const requestedPoolLiquidity = minimumPoolLiquidityForLoan(Number(form.amount), maxLoanBps);
  const additionalFundingForRequest = Math.max(0, requestedPoolLiquidity - poolLiquidity);

  const myOutstanding = useMemo(() => {
    if (!walletAddress) return [];
    const w = walletAddress.toLowerCase();
    return loans.filter(
      (l) => isOutstandingLoan(l) && l.borrowerWallet?.toLowerCase() === w,
    );
  }, [loans, walletAddress]);

  const selectedRepayLoan = useMemo(
    () => myOutstanding.find((l) => l.id === repayLoanId) ?? myOutstanding[0] ?? null,
    [myOutstanding, repayLoanId],
  );

  useEffect(() => {
    if (selectedRepayLoan && repayLoanId !== selectedRepayLoan.id) {
      setRepayLoanId(selectedRepayLoan.id);
    }
    if (!selectedRepayLoan) setRepayLoanId('');
  }, [selectedRepayLoan, repayLoanId]);

  const displayed = useMemo(() => {
    if (tab === 'all') return loans;
    if (tab === 'approved') {
      return loans.filter((l) => l.status === 'approved' || l.status === 'active');
    }
    if (tab === 'completed') {
      return loans.filter((l) => l.status === 'completed');
    }
    return loans.filter((l) => l.status === tab);
  }, [loans, tab]);

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: loans.length },
    { key: 'pending', label: 'Governance', count: pendingN },
    { key: 'approved', label: 'Outstanding', count: loans.filter(isOutstandingLoan).length },
    { key: 'completed', label: 'Repaid', count: loans.filter((l) => l.status === 'completed').length },
    { key: 'rejected', label: 'Declined', count: loans.filter((l) => l.status === 'rejected').length },
  ];

  const submitRepayment = async () => {
    setRepayError('');
    setRepaySuccess('');
    if (!activeCooperative) {
      setRepayError('No cooperative selected.');
      return;
    }
    if (!walletAddress) {
      setRepayError('Connect your wallet to repay a loan.');
      return;
    }
    const loan = selectedRepayLoan;
    if (!loan) {
      setRepayError('You have no outstanding loans to repay.');
      return;
    }
    const remaining = remainingBalance(loan);
    let amount = Number(repayAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setRepayError('Enter a valid repayment amount.');
      return;
    }
    if (amount > remaining) {
      amount = remaining; // cap to remaining (standard)
    }

    setRepaying(true);
    try {
      // ── On-chain repayment ──────────────────────────────────────────────
      if (onChainMode) {
        const chainId = onChainLoanIdFromAppId(loan.id);
        if (!chainId) {
          setRepayError('This loan is not linked to the on-chain pool.');
          return;
        }
        const { amount: paid } = await repayLoanOnChain({
          loanId: chainId,
          amountUsd: amount,
        });
        setRepayAmount('');
        setRepaySuccess(
          `On-chain repayment of ${formatCurrency(paid, currency)} submitted. Complete wallet / PIN prompts. Interest is taken first, then principal returns to the pool.`,
        );
        setDistLog([
          {
            id: `p-${Date.now()}`,
            label: 'On-chain repayment',
            amount: paid,
            tone: 'principal',
          },
        ]);
        await new Promise((r) => setTimeout(r, 2500));
        await reload();
        return;
      }

      // ── Legacy localStorage path (only when pool not configured) ───────
      const result = applyLoanRepayment(
        activeCooperative.id,
        loan.id,
        amount,
        walletAddress,
      );

      const cashIn =
        Math.round((result.cashToRestore + result.interestToTreasury) * 100) / 100;
      if (cashIn > 0) {
        const nextTreasury =
          Math.round(((activeCooperative.treasuryBalance ?? 0) + cashIn) * 100) / 100;
        updateCooperative(activeCooperative.id, { treasuryBalance: nextTreasury });
        refresh();
      }

      setDistLog([
        {
          id: `p-${Date.now()}`,
          label: 'Loan Principal Returned',
          amount: result.principalPortion,
          tone: 'principal',
        },
        {
          id: `i-${Date.now()}`,
          label: 'Interest Earned',
          amount: result.interestPortion,
          tone: 'interest',
        },
        {
          id: `t-${Date.now()}`,
          label: 'Treasury Updated',
          amount: cashIn,
          tone: 'treasury',
        },
        {
          id: `s-${Date.now()}`,
          label: 'Savings Vault Updated',
          amount: Math.round(result.interestPortion * 0.05 * 100) / 100,
          tone: 'savings',
        },
      ]);

      setLoans(loadLoans(activeCooperative.id));
      setRepayAmount('');
      const intNote =
        result.interestPortion > 0
          ? ` Interest ${formatCurrency(result.interestPortion, currency)} → cooperative profit.`
          : '';
      if (result.fullyPaid) {
        setRepaySuccess(
          `Fully repaid ${formatCurrency(result.amountPaid, currency)}. Loan closed.${intNote}`,
        );
        setRepayLoanId('');
      } else {
        setRepaySuccess(
          `Paid ${formatCurrency(result.amountPaid, currency)}. Still owed ${formatCurrency(result.remaining, currency)}.${intNote}`,
        );
      }
    } catch (e) {
      setRepayError(onChainMode ? friendlyLoanError(e) : e instanceof Error ? e.message : 'Repayment failed.');
    } finally {
      setRepaying(false);
    }
  };

  const previewFinance = useMemo(() => {
    const amt = Number(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) return null;
    return computeLoanFinance(amt, form.months);
  }, [form.amount, form.months]);

  const onApproveLoan = async (loan: Loan) => {
    const chainId = onChainLoanIdFromAppId(loan.id);
    if (!chainId) return;
    setActionBusyId(loan.id);
    setChainMsg(null);
    setPoolError(null);
    try {
      // Check immediately before the wallet transaction. A pending request is
      // valid without funds, while approval requires live pool liquidity.
      const currentPool = await fetchPoolSnapshot(walletAddress);
      const requiredLiquidity = minimumPoolLiquidityForLoan(
        loan.requestedAmount,
        currentPool.maxLoanBps,
      );
      if (currentPool.liquidity + 0.000001 < requiredLiquidity) {
        const shortfall = Math.max(0, requiredLiquidity - currentPool.liquidity);
        setPoolError(
          `Cannot approve this loan yet. The pool has ${formatCurrency(currentPool.liquidity, currency)}, but this ${formatCurrency(loan.requestedAmount, currency)} loan needs at least ${formatCurrency(requiredLiquidity, currency)} in pool liquidity under the ${((currentPool.maxLoanBps / 100).toFixed(0))}% single-loan limit. Fund at least ${formatCurrency(shortfall, currency)} and try again.`,
        );
        setPoolSnap(currentPool);
        return;
      }
      await approveLoanOnChain(chainId);
      setChainMsg(
        `Approve submitted for ${formatCurrency(loan.requestedAmount, currency)}. USDC will disburse after confirmation.`,
      );
      await new Promise((r) => setTimeout(r, 2500));
      await reload();
    } catch (e) {
      setPoolError(friendlyLoanError(e));
    } finally {
      setActionBusyId(null);
    }
  };

  const onRejectLoan = async (loan: Loan) => {
    const chainId = onChainLoanIdFromAppId(loan.id);
    if (!chainId) return;
    setActionBusyId(loan.id);
    setChainMsg(null);
    try {
      await rejectLoanOnChain(chainId);
      setChainMsg('Reject transaction submitted.');
      await new Promise((r) => setTimeout(r, 2500));
      await reload();
    } catch (e) {
      setFormError(friendlyLoanError(e));
    } finally {
      setActionBusyId(null);
    }
  };

  const onFundPool = async () => {
    const amt = Number(fundAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setPoolError('Enter a valid USDC amount to fund the pool.');
      return;
    }
    setFundBusy(true);
    setFormError('');
    setChainMsg(null);
    setPoolError(null);
    try {
      await fundPoolOnChain({ amountUsd: amt });
      setChainMsg(`Fund pool of ${formatCurrency(amt, currency)} submitted.`);
      setFundAmount('');
      await new Promise((r) => setTimeout(r, 2500));
      await reload();
    } catch (e) {
      setPoolError(friendlyLoanError(e));
    } finally {
      setFundBusy(false);
    }
  };

  const onRegisterSelf = async () => {
    if (!walletAddress) {
      setPoolError('Connect your wallet first.');
      return;
    }
    setActionBusyId('register');
    setPoolError(null);
    setChainMsg(null);
    try {
      await registerBorrowerOnChain(walletAddress as `0x${string}`);
      setChainMsg('Borrower registration submitted (organizer only).');
      await new Promise((r) => setTimeout(r, 2500));
      await reload();
    } catch (e) {
      setPoolError(friendlyLoanError(e));
    } finally {
      setActionBusyId(null);
    }
  };

  const submitApplication = async () => {
    setFormError('');
    setAssessment(null);
    setLastCreated(null);
    setChainMsg(null);

    if (!activeCooperative) {
      setFormError('Create or join a cooperative first.');
      return;
    }
    if (!walletAddress) {
      setFormError('Connect your wallet to apply for a loan.');
      return;
    }

    let member = applicant;
    if (!member) {
      // Founder / self not yet on roster — synthesize minimal applicant from identity
      const name =
        identity?.displayName ||
        identity?.nametag ||
        `Member ${walletAddress.slice(0, 6)}`;
      const initials = name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0] ?? '')
        .join('')
        .toUpperCase() || walletAddress.slice(2, 4).toUpperCase();
      member = {
        id: `temp-${walletAddress.slice(-6)}`,
        name,
        email: '',
        avatar: '',
        initials,
        walletIdentity: walletAddress,
        role: 'member',
        contributionScore: 70,
        riskScore: 40,
        reputation: 3.5,
        status: 'active',
        joinedAt: new Date().toISOString(),
        totalContributed: 0,
        missedContributions: 0,
        activeLoans: 0,
        creditScore: 70,
        contributionStatus: 'waiting',
      };
    }

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Enter a valid loan amount greater than zero.');
      return;
    }
    if (!form.purpose) {
      setFormError('Select a loan purpose.');
      return;
    }
    if (!form.reason.trim()) {
      setFormError('Please describe the reason for this loan.');
      return;
    }
    if (!form.agreed) {
      setFormError('You must agree to repay according to cooperative rules.');
      return;
    }

    setEvaluating(true);

    // ── On-chain path: AI is advisory; apply always hits the pool ───────────
    if (onChainMode) {
      try {
        if (poolSnap && !poolSnap.canApply && poolSnap.canApplyReason) {
          setEvaluating(false);
          setFormError(friendlyLoanError(new Error(poolSnap.canApplyReason)));
          return;
        }

        const delay = 1200 + Math.random() * 800;
        await new Promise((r) => setTimeout(r, delay));

        const result = evaluateLoanApplication({
          cooperative: activeCooperative,
          applicant: member,
          existingLoans: loans,
          requestedAmount: amount,
          repaymentMonths: form.months,
        });
        setAssessment(result);

        // An application creates a pending on-chain request only. Do not block
        // it based on a cached treasury or pool balance; approval is guarded by
        // a fresh on-chain liquidity check immediately before disbursement.
        await applyForLoanOnChain({
          principalUsd: amount,
          termMonths: form.months,
          purpose: form.purpose,
        });

        const aiNote =
          result.decision === 'DECLINED'
            ? ' AI recommended decline — organizer still decides on-chain.'
            : result.decision === 'REQUIRES_GOVERNANCE_REVIEW'
              ? ' AI flagged for governance review.'
              : ' AI recommended approval.';

        setChainMsg(
          `On-chain loan application for ${formatCurrency(amount, currency)} submitted.${aiNote} Status is Pending until the organizer (or lending agent) approves and USDC is disbursed.`,
        );
        setForm(EMPTY_FORM);
        await new Promise((r) => setTimeout(r, 2500));
        await reload();
      } catch (e) {
        setFormError(friendlyLoanError(e));
      } finally {
        setEvaluating(false);
      }
      return;
    }

    // ── Legacy localStorage path ────────────────────────────────────────────
    const delay = 2000 + Math.random() * 1000;
    await new Promise((r) => setTimeout(r, delay));

    const result = evaluateLoanApplication({
      cooperative: activeCooperative,
      applicant: member,
      existingLoans: loans,
      requestedAmount: amount,
      repaymentMonths: form.months,
    });

    setAssessment(result);

    let cashTaken = false;
    if (result.decision === 'APPROVED') {
      const cash = activeCooperative.treasuryBalance ?? 0;
      if (amount > cash) {
        setEvaluating(false);
        setFormError(
          `Insufficient treasury cash (${formatCurrency(cash, currency)}) to disburse ${formatCurrency(amount, currency)}. Deposit funds or request a smaller amount.`,
        );
        return;
      }
      const next = Math.round((cash - amount) * 100) / 100;
      updateCooperative(activeCooperative.id, {
        treasuryBalance: Math.max(0, next),
      });
      refresh();
      cashTaken = true;
    }

    const loan = createLoanAndNotify(
      activeCooperative.id,
      {
        applicant: member,
        amount,
        purposeCategory: form.purpose,
        reason: form.reason.trim(),
        repaymentMonths: form.months,
        assessment: result,
      },
      { cashDisbursedFromTreasury: cashTaken },
    );

    setLastCreated(loan);
    setLoans(loadLoans(activeCooperative.id));
    setEvaluating(false);
    setForm(EMPTY_FORM);
  };

  if (!activeCooperative) {
    return (
      <DashboardLayout>
        <div className="px-4 sm:px-6 py-12 sm:py-16 max-w-lg mx-auto text-center">
          <Banknote className="w-12 h-12 text-stone-200 dark:text-white/10 mx-auto mb-4" />
          <p className="font-display font-bold text-stone-800 dark:text-white mb-2">No cooperative</p>
          <p className="text-sm text-stone-400 dark:text-white/40">
            Create or join a cooperative to apply for loans.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 py-5 sm:py-6 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 mb-6 sm:mb-7"
        >
          <div className="min-w-0">
            <h1 className="text-xl font-display font-bold text-stone-900 dark:text-white">Loans</h1>
            <p className="text-sm text-stone-400 dark:text-white/40 mt-0.5 break-words">
              {onChainMode
                ? `${formatCurrency(poolApprovalCapacity, currency)} current approval capacity`
                : `${formatCurrency(treasuryLoanAvailable, currency)} available from Treasury`}
              {' · '}
              {formatCurrency(outstanding, currency)} outstanding
              {onChainMode && loadingChain ? ' · refreshing…' : ''}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setShowRepay(false);
                setRepayError('');
                setRepaySuccess('');
              }}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-colors whitespace-nowrap',
                !showRepay
                  ? 'bg-[#6393C4] text-white border-[#6393C4]'
                  : 'border-stone-200 dark:border-white/10 text-stone-600 dark:text-white/60 hover:bg-stone-50 dark:hover:bg-white/5',
              )}
            >
              <Banknote className="w-4 h-4 flex-shrink-0" />
              <span className="sm:hidden">Apply</span>
              <span className="hidden sm:inline">Apply for Loan</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRepay(true);
                setFormError('');
                setAssessment(null);
              }}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-colors whitespace-nowrap',
                showRepay
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'border-stone-200 dark:border-white/10 text-stone-600 dark:text-white/60 hover:bg-stone-50 dark:hover:bg-white/5',
              )}
            >
              <RefreshCcw className="w-4 h-4 flex-shrink-0" />
              <span className="sm:hidden">Repay</span>
              <span className="hidden sm:inline">Loan Repayment</span>
              {myOutstanding.length > 0 && (
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                  showRepay ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
                )}>
                  {myOutstanding.length}
                </span>
              )}
            </button>
          </div>
        </motion.div>

        {/* On-chain pool status */}
        {onChainMode ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl border border-[#6393C4]/25 bg-[#6393C4]/5 dark:bg-[#6393C4]/10 p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-2 min-w-0">
                <Shield className="w-4 h-4 text-[#6393C4] mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-800 dark:text-white">
                    Loan Pool
                  </p>
                  <p className="text-[11px] text-stone-500 dark:text-white/45 mt-0.5">
                    Max {((poolSnap?.maxLoanBps ?? 2500) / 100).toFixed(0)}% of pool liquidity
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void reload()}
                disabled={loadingChain}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6393C4] hover:underline disabled:opacity-50"
              >
                {loadingChain ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                Refresh
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
              <div className="rounded-xl bg-white/70 dark:bg-black/20 px-3 py-2">
                <p className="text-stone-400 dark:text-white/35">USDC liquidity</p>
                <p className="font-bold text-stone-800 dark:text-white tabular-nums">
                  {formatCurrency(poolLiquidity, currency)}
                </p>
              </div>
              <div className="rounded-xl bg-white/70 dark:bg-black/20 px-3 py-2">
                <p className="text-stone-400 dark:text-white/35">Approval capacity</p>
                <p className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatCurrency(poolApprovalCapacity, currency)}
                </p>
              </div>
              <div className="rounded-xl bg-white/70 dark:bg-black/20 px-3 py-2">
                <p className="text-stone-400 dark:text-white/35">Outstanding</p>
                <p className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  {formatCurrency(poolSnap?.outstandingPrincipal ?? 0, currency)}
                </p>
              </div>
              <div className="rounded-xl bg-white/70 dark:bg-black/20 px-3 py-2">
                <p className="text-stone-400 dark:text-white/35">You can apply</p>
                <p className="font-bold text-stone-800 dark:text-white">
                  {poolSnap?.canApply ? 'Yes' : poolSnap?.isEligibleBorrower === false ? 'Not eligible' : 'No'}
                </p>
              </div>
            </div>
            {poolSnap?.isOrganizer && (
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide">
                    Fund pool (USDC)
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    placeholder="500"
                    className="mt-1 w-full rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-[#2E3B4B]/40 px-3 py-2 text-sm outline-none focus:border-[#6393C4]/50"
                  />
                </div>
                <button
                  type="button"
                  disabled={fundBusy}
                  onClick={() => void onFundPool()}
                  className="px-4 py-2.5 rounded-xl bg-[#6393C4] text-white text-sm font-semibold hover:bg-[#5289B8] disabled:opacity-60"
                >
                  {fundBusy ? 'Funding…' : 'Fund pool'}
                </button>
                <button
                  type="button"
                  disabled={actionBusyId === 'register' || !walletAddress}
                  onClick={() => void onRegisterSelf()}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-white/10 text-sm font-semibold text-stone-700 dark:text-white/70 hover:bg-stone-50 dark:hover:bg-white/5 disabled:opacity-60"
                >
                  {actionBusyId === 'register' ? '…' : 'Register my wallet'}
                </button>
              </div>
            )}
            {!poolSnap?.isEligibleBorrower && poolSnap?.configured && isConnected && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-3">
                Not eligible — register on the vault or ask the organizer to add your wallet.
              </p>
            )}
            {poolError && (
              <p role="alert" className="text-xs text-red-700 dark:text-red-400 mt-3 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                {poolError}
              </p>
            )}
            {chainMsg && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-3">{chainMsg}</p>
            )}
          </motion.div>
        ) : (
          <div className="mb-6 rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/80 dark:bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            Loan pool not configured. Using local records.
          </div>
        )}

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-6"
        >
          {[
            {
              label: 'Pending Review',
              value: String(pendingN),
              color: 'text-[#6393C4]',
              bg: 'bg-[#6393C4]/8 dark:bg-[#6393C4]/10',
            },
            {
              label: 'Active Loans',
              value: String(activeN),
              color: 'text-emerald-500',
              bg: 'bg-emerald-50 dark:bg-emerald-500/10',
            },
            {
              label: onChainMode ? 'Pool liquidity' : 'Total Disbursed',
              value: onChainMode
                ? formatCurrency(poolSnap?.liquidity ?? 0, currency)
                : formatCurrency(disbursed, currency),
              color: 'text-blue-500',
              bg: 'bg-blue-50 dark:bg-blue-500/10',
            },
            {
              label: 'Repayment Rate',
              value: repayRate == null ? '—' : `${repayRate}%`,
              color: 'text-[#6393C4]',
              bg: 'bg-[#6393C4]/5 dark:bg-[#6393C4]/10',
            },
          ].map(({ label, value, color, bg }) => (
            <div
              key={label}
              className={cn('rounded-2xl p-3 sm:p-4 border border-stone-100 dark:border-[#1A2A3A] min-w-0', bg)}
            >
              <p className="text-[11px] sm:text-xs text-stone-400 dark:text-white/40 mb-1 truncate">{label}</p>
              <p className={cn('text-base sm:text-xl font-display font-bold tabular-nums break-words', color)}>{value}</p>
            </div>
          ))}
        </motion.div>

        {/* Loan Repayment */}
        {showRepay && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5 sm:p-6 mb-6"
          >
            <div className="flex items-start gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <ArrowDownToLine className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="font-display font-bold text-stone-900 dark:text-white text-base">
                  Loan Repayment
                </h2>
              </div>
            </div>

            {!walletAddress ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Connect your wallet to repay loans.
              </p>
            ) : myOutstanding.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-stone-200 dark:border-white/10 rounded-xl">
                <CheckCircle2 className="w-8 h-8 text-emerald-400/80 mx-auto mb-2" />
                <p className="text-sm font-semibold text-stone-700 dark:text-white/70">No outstanding loans</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-5">
                  {myOutstanding.map((loan) => {
                    const rem = remainingBalance(loan);
                    const principal = loan.approvedAmount ?? loan.requestedAmount;
                    const paid = loan.paidAmount ?? 0;
                    const pct = principal > 0 ? Math.round((paid / principal) * 100) : 0;
                    const selected = (selectedRepayLoan?.id ?? '') === loan.id;
                    return (
                      <button
                        key={loan.id}
                        type="button"
                        onClick={() => {
                          setRepayLoanId(loan.id);
                          setRepayAmount('');
                          setRepayError('');
                          setRepaySuccess('');
                        }}
                        className={cn(
                          'w-full text-left rounded-xl border p-4 transition-all',
                          selected
                            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/10'
                            : 'border-stone-200 dark:border-white/10 hover:border-stone-300 dark:hover:border-white/20',
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-stone-800 dark:text-white">
                              {loan.purposeCategory ?? loan.purpose} loan
                            </p>
                            <p className="text-[11px] text-stone-400 dark:text-white/35 mt-0.5">
                              Principal {formatCurrency(principal, currency)}
                              {loan.dueDate ? ` · Due ${formatDate(loan.dueDate)}` : ''}
                              {' · '}
                              {loan.repaymentMonths} mo term
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                              {formatCurrency(rem, currency)}
                            </p>
                            <p className="text-[10px] text-stone-400 dark:text-white/35">remaining</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-[10px] mb-1 text-stone-400">
                            <span>Progress</span>
                            <span>{pct}% repaid · {formatCurrency(paid, currency)} paid</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-stone-100 dark:bg-white/8 overflow-hidden">
                            <div
                              className="h-full bg-emerald-400 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedRepayLoan && (() => {
                  const L = ensureLoanFinance(selectedRepayLoan);
                  const principal = L.approvedAmount ?? L.requestedAmount;
                  const totalDue = L.totalRepayment ?? principal;
                  const paid = L.paidAmount ?? 0;
                  const rem = remainingBalance(L);
                  const pct = totalDue > 0 ? Math.round((paid / totalDue) * 100) : 0;
                  const nextPay = nextPaymentEstimate(L);
                  const history = L.repaymentHistory ?? [];
                  return (
                    <div className="space-y-4">
                      {/* Loan detail panel */}
                      <div className="rounded-xl border border-stone-100 dark:border-white/8 bg-stone-50/80 dark:bg-[#2E3B4B]/25 p-4">
                        <p className="text-xs font-semibold text-stone-500 dark:text-white/50 uppercase tracking-wide mb-3">
                          Loan details
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
                          {[
                            { l: 'Loan Amount', v: formatCurrency(principal, currency) },
                            { l: 'Interest Rate', v: formatInterestPct(L.interestRate ?? 0.05) },
                            { l: 'Total Repayment', v: formatCurrency(totalDue, currency) },
                            { l: 'Remaining Balance', v: formatCurrency(rem, currency) },
                            { l: 'Due Date', v: L.dueDate ? formatDate(L.dueDate) : '—' },
                            { l: 'Next Payment', v: formatCurrency(nextPay, currency) },
                          ].map(({ l, v }) => (
                            <div key={l} className="rounded-lg bg-white dark:bg-white/5 border border-stone-100 dark:border-white/6 px-2.5 py-2 min-w-0">
                              <p className="text-[10px] text-stone-400 dark:text-white/35">{l}</p>
                              <p className="text-sm font-bold text-stone-800 dark:text-white tabular-nums break-words">{v}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mb-4">
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-stone-400 dark:text-white/40">Repayment progress</span>
                            <span className="font-semibold text-stone-600 dark:text-white/60">{pct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-stone-100 dark:bg-white/8 overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 mb-3">
                          <div className="flex-1 space-y-1.5">
                            <label className="text-[11px] text-stone-400 dark:text-white/40">
                              Amount (max {formatCurrency(rem, currency)})
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={repayAmount}
                              onChange={(e) => {
                                setRepayAmount(e.target.value);
                                setRepayError('');
                                setRepaySuccess('');
                              }}
                              placeholder="0.00"
                              disabled={repaying}
                              className="w-full bg-white dark:bg-[#2E3B4B]/40 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-white outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 disabled:opacity-60"
                            />
                          </div>
                          <div className="flex flex-wrap items-end gap-2">
                            <button
                              type="button"
                              disabled={repaying}
                              onClick={() => setRepayAmount(String(nextPay))}
                              className="flex-1 sm:flex-none px-3 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-60 transition-colors"
                            >
                              Pay Now
                            </button>
                            <button
                              type="button"
                              disabled={repaying}
                              onClick={() => setRepayAmount(String(rem))}
                              className="flex-1 sm:flex-none px-3 py-2.5 rounded-xl border border-stone-200 dark:border-white/10 text-xs font-semibold text-stone-600 dark:text-white/60 hover:bg-white dark:hover:bg-white/5 transition-colors"
                            >
                              Pay Full Balance
                            </button>
                            <button
                              type="button"
                              disabled={repaying}
                              onClick={submitRepayment}
                              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#6393C4] text-white text-sm font-semibold hover:bg-[#5289B8] disabled:opacity-60 transition-colors"
                            >
                              {repaying ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RefreshCcw className="w-4 h-4" />
                              )}
                              Confirm
                            </button>
                            <button
                              type="button"
                              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-stone-200 dark:border-white/10 text-xs font-semibold text-stone-500 dark:text-white/50"
                              onClick={() => {
                                const lines = [
                                  `Nexusu Loan Statement`,
                                  `Borrower: ${L.borrowerName}`,
                                  `Principal: ${formatCurrency(principal, currency)}`,
                                  `Interest: ${formatInterestPct(L.interestRate ?? 0.05)}`,
                                  `Total due: ${formatCurrency(totalDue, currency)}`,
                                  `Paid: ${formatCurrency(paid, currency)}`,
                                  `Remaining: ${formatCurrency(rem, currency)}`,
                                ].join('\n');
                                void navigator.clipboard?.writeText(lines);
                                setRepaySuccess('Statement copied to clipboard.');
                              }}
                            >
                              <Download className="w-3.5 h-3.5" /> Statement
                            </button>
                          </div>
                        </div>
                        {repayError && (
                          <p className="text-xs text-red-500 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {repayError}
                          </p>
                        )}
                        {repaySuccess && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {repaySuccess}
                          </p>
                        )}
                      </div>

                      {/* Loan monitoring */}
                      <div className="rounded-xl border border-[#6393C4]/20 bg-[#6393C4]/5 dark:bg-[#6393C4]/8 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-4 h-4 text-[#6393C4]" />
                          <p className="text-xs font-bold uppercase tracking-wider text-[#6393C4]">
                            Loan status
                          </p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { l: 'Credit Health', v: L.riskScore <= 35 ? 'Excellent' : L.riskScore <= 55 ? 'Good' : 'Watch' },
                            { l: 'Repayment', v: paid > 0 ? 'On Track' : 'New loan' },
                            { l: 'Missed', v: '0' },
                            { l: 'Risk', v: L.riskLevel ?? riskLabel(L.riskScore) },
                          ].map(({ l, v }) => (
                            <div key={l} className="rounded-lg bg-white/80 dark:bg-white/5 border border-[#6393C4]/15 px-2.5 py-2">
                              <p className="text-[10px] text-stone-400 dark:text-white/40">{l}</p>
                              <p className="text-sm font-bold text-stone-800 dark:text-white">{v}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Interest distribution log */}
                      {distLog.length > 0 && (
                        <div className="rounded-xl border border-stone-100 dark:border-white/8 p-4">
                          <p className="text-xs font-semibold text-stone-500 dark:text-white/50 uppercase tracking-wide mb-3">
                            Automatic interest distribution
                          </p>
                          <ul className="space-y-2">
                            {distLog.map((line) => (
                              <li
                                key={line.id}
                                className="flex items-center justify-between gap-3 text-sm"
                              >
                                <span className="text-stone-600 dark:text-white/65">{line.label}</span>
                                <span
                                  className={cn(
                                    'font-bold tabular-nums',
                                    line.tone === 'interest' || line.tone === 'savings'
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-stone-800 dark:text-white',
                                  )}
                                >
                                  {formatCurrency(line.amount, currency)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Repayment history */}
                      {history.length > 0 && (
                        <div className="rounded-xl border border-stone-100 dark:border-white/8 p-4">
                          <p className="text-xs font-semibold text-stone-500 dark:text-white/50 uppercase tracking-wide mb-3">
                            Repayment History
                          </p>
                          <div className="space-y-2">
                            {history.map((h) => (
                              <div
                                key={h.id}
                                className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-stone-50 dark:border-white/4 pb-2 last:border-0 last:pb-0"
                              >
                                <span className="text-stone-400 dark:text-white/40">{formatDate(h.date)}</span>
                                <span className="font-semibold text-stone-800 dark:text-white">
                                  {formatCurrency(h.amount, currency)}
                                </span>
                                <span className="text-stone-400 dark:text-white/35 w-full sm:w-auto">
                                  Principal {formatCurrency(h.principalPortion, currency)} · Interest{' '}
                                  {formatCurrency(h.interestPortion, currency)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </motion.section>
        )}

        {/* Apply for Loan */}
        {!showRepay && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5 sm:p-6 mb-6"
        >
          <div className="flex items-start gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-[#6393C4]/10 flex items-center justify-center flex-shrink-0">
              <Banknote className="w-4 h-4 text-[#6393C4]" />
            </div>
            <div>
              <h2 className="font-display font-bold text-stone-900 dark:text-white text-base">
                Apply for Loan
              </h2>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-500 dark:text-white/50 uppercase tracking-wide">
                Loan Amount <span className="text-[#6393C4]">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="200"
                disabled={evaluating}
                className="w-full bg-stone-50 dark:bg-[#2E3B4B]/40 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-white placeholder:text-stone-400 outline-none focus:border-[#6393C4]/50 focus:ring-2 focus:ring-[#6393C4]/10 disabled:opacity-60"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-500 dark:text-white/50 uppercase tracking-wide">
                Loan Purpose <span className="text-[#6393C4]">*</span>
              </label>
              <select
                value={form.purpose}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    purpose: e.target.value as LoanPurposeCategory | '',
                  }))
                }
                disabled={evaluating}
                className="w-full bg-stone-50 dark:bg-[#2E3B4B]/40 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-white outline-none focus:border-[#6393C4]/50 focus:ring-2 focus:ring-[#6393C4]/10 disabled:opacity-60"
              >
                <option value="">Select purpose</option>
                {PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-500 dark:text-white/50 uppercase tracking-wide">
                Repayment Period <span className="text-[#6393C4]">*</span>
              </label>
              <select
                value={form.months}
                onChange={(e) => setForm((f) => ({ ...f, months: Number(e.target.value) }))}
                disabled={evaluating}
                className="w-full bg-stone-50 dark:bg-[#2E3B4B]/40 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-white outline-none focus:border-[#6393C4]/50 focus:ring-2 focus:ring-[#6393C4]/10 disabled:opacity-60"
              >
                {PERIODS.map((p) => (
                  <option key={p.months} value={p.months}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-stone-500 dark:text-white/50 uppercase tracking-wide">
                Reason <span className="text-[#6393C4]">*</span>
              </label>
              <textarea
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                rows={3}
                disabled={evaluating}
                placeholder="Loan purpose"
                className="w-full bg-stone-50 dark:bg-[#2E3B4B]/40 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-white placeholder:text-stone-400 outline-none focus:border-[#6393C4]/50 focus:ring-2 focus:ring-[#6393C4]/10 resize-none disabled:opacity-60"
              />
            </div>
          </div>

          {onChainMode && previewFinance && (
            <div
              className={cn(
                'mb-4 rounded-xl border px-3.5 py-3 text-xs leading-relaxed',
                additionalFundingForRequest > 0
                  ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
              )}
            >
              <p className="font-semibold mb-0.5">Approval readiness</p>
              {additionalFundingForRequest > 0 ? (
                <p>
                  You can submit this request now, but it cannot be approved until the pool is funded.
                  This {formatCurrency(previewFinance.principal, currency)} loan needs at least{' '}
                  {formatCurrency(requestedPoolLiquidity, currency)} in pool liquidity under the{' '}
                  {(maxLoanBps / 100).toFixed(0)}% single-loan limit. Add at least{' '}
                  {formatCurrency(additionalFundingForRequest, currency)} to the pool.
                </p>
              ) : (
                <p>
                  Current pool liquidity can support this amount, subject to the on-chain check at approval
                  time and any other pending approvals.
                </p>
              )}
            </div>
          )}

          {/* Interest schedule */}
          <div className="mb-4 rounded-xl border border-stone-100 dark:border-white/8 bg-stone-50/80 dark:bg-[#2E3B4B]/25 p-4">
            <p className="text-xs font-semibold text-stone-700 dark:text-white/75 mb-3">
              Interest schedule
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
              {LOAN_INTEREST_TABLE.map((row) => (
                <button
                  key={row.months}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, months: row.months }))}
                  className={cn(
                    'rounded-lg border px-2 py-2 text-center transition-colors',
                    form.months === row.months
                      ? 'border-[#6393C4] bg-[#6393C4]/10 text-[#5289B8] dark:text-[#77A6DB]'
                      : 'border-stone-200 dark:border-white/10 text-stone-600 dark:text-white/55 hover:border-[#6393C4]/40',
                  )}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    {row.months} mo
                  </p>
                  <p className="text-sm font-bold">{Math.round(row.rate * 100)}%</p>
                </button>
              ))}
            </div>
            {previewFinance && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-lg bg-white dark:bg-white/5 px-2.5 py-2 border border-stone-100 dark:border-white/6">
                  <p className="text-stone-400 dark:text-white/35">Principal</p>
                  <p className="font-bold text-stone-800 dark:text-white">
                    {formatCurrency(previewFinance.principal, currency)}
                  </p>
                </div>
                <div className="rounded-lg bg-white dark:bg-white/5 px-2.5 py-2 border border-stone-100 dark:border-white/6">
                  <p className="text-stone-400 dark:text-white/35">Interest</p>
                  <p className="font-bold text-stone-800 dark:text-white">
                    {formatCurrency(previewFinance.totalInterest, currency)}
                  </p>
                </div>
                <div className="rounded-lg bg-white dark:bg-white/5 px-2.5 py-2 border border-stone-100 dark:border-white/6">
                  <p className="text-stone-400 dark:text-white/35">Total repayment</p>
                  <p className="font-bold text-stone-800 dark:text-white">
                    {formatCurrency(previewFinance.totalRepayment, currency)}
                  </p>
                </div>
                <div className="rounded-lg bg-white dark:bg-white/5 px-2.5 py-2 border border-stone-100 dark:border-white/6">
                  <p className="text-stone-400 dark:text-white/35">Monthly</p>
                  <p className="font-bold text-stone-800 dark:text-white">
                    {formatCurrency(previewFinance.monthlyPayment, currency)}
                  </p>
                </div>
              </div>
            )}
          </div>

          <label className="flex items-start gap-3 mb-4 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.agreed}
              onChange={(e) => setForm((f) => ({ ...f, agreed: e.target.checked }))}
              disabled={evaluating}
              className="mt-1 rounded border-stone-300 text-[#6393C4] focus:ring-[#6393C4]"
            />
            <span className="text-sm text-stone-600 dark:text-white/65">
              I agree to repay according to cooperative rules.
            </span>
          </label>

          {formError && (
            <p className="text-xs text-red-500 mb-3 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {formError}
            </p>
          )}

          <button
            type="button"
            onClick={() => void submitApplication()}
            disabled={evaluating}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#6393C4] text-white text-sm font-semibold hover:bg-[#5289B8] disabled:opacity-60 transition-colors"
          >
            {evaluating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Evaluating…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Apply for Loan
              </>
            )}
          </button>

          <AnimatePresence>
            {evaluating && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-5 flex items-center gap-3 rounded-xl border border-[#6393C4]/20 bg-[#6393C4]/5 dark:bg-[#6393C4]/10 px-4 py-3"
              >
                <Loader2 className="w-5 h-5 text-[#6393C4] animate-spin flex-shrink-0" />
                <p className="text-sm font-semibold text-[#5289B8] dark:text-[#77A6DB]">
                  Evaluating application…
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
        )}

        {/* AI Assessment (from latest application) */}
        {!showRepay && assessment && (
          <div className="mb-6">
            <AiEvaluationCard assessment={assessment} currency={currency} />
          </div>
        )}

        {/* Applications list */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-stone-800 dark:text-white">Applications</h2>
          {lastCreated && (
            <span className="text-[11px] text-stone-400 dark:text-white/35">
              Latest: {lastCreated.borrowerName} · {formatCurrency(lastCreated.requestedAmount, currency)}
            </span>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12 }}
          className="flex gap-1 mb-6 bg-stone-100 dark:bg-[#2E3B4B]/40 rounded-xl p-1 w-fit flex-wrap"
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
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
                <span
                  className={cn(
                    'ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full',
                    tab === t.key
                      ? 'bg-[#6393C4]/10 text-[#6393C4]'
                      : 'bg-stone-200 dark:bg-white/10 text-stone-500 dark:text-white/40',
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </motion.div>

        {/* Table (desktop) */}
        {displayed.length > 0 && (
          <div className="hidden md:block bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 dark:border-[#1A2A3A]">
                  {['Member', 'Requested Amount', 'Purpose', 'Repayment Period', 'AI Risk', 'Status', 'Submitted'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[11px] font-semibold text-stone-400 dark:text-white/30 uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {displayed.map((loan) => {
                  const cfg = STATUS_CONFIG[loan.status];
                  const label = loan.aiDecision
                    ? decisionBadgeLabel(loan.aiDecision)
                    : cfg.label;
                  return (
                    <tr
                      key={loan.id}
                      className="border-b border-stone-50 dark:border-white/4 last:border-0 hover:bg-stone-50/50 dark:hover:bg-white/2"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar initials={loan.borrowerInitials} />
                          <span className="font-medium text-stone-800 dark:text-white">
                            {loan.borrowerName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-stone-800 dark:text-white">
                        {formatCurrency(loan.requestedAmount, currency)}
                      </td>
                      <td className="px-4 py-3 text-stone-600 dark:text-white/60">
                        {loan.purposeCategory ?? loan.purpose}
                      </td>
                      <td className="px-4 py-3 text-stone-600 dark:text-white/60">
                        {loan.repaymentMonths} month{loan.repaymentMonths === 1 ? '' : 's'}
                      </td>
                      <td className={cn('px-4 py-3 font-semibold', riskColor(loan.riskScore))}>
                        {loan.riskLevel ?? riskLabel(loan.riskScore)} Risk
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                            cfg.class,
                          )}
                        >
                          {label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-400 dark:text-white/40 whitespace-nowrap">
                        {formatDate(loan.requestedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Cards (mobile + always as secondary grid when has items) */}
        {displayed.length === 0 ? (
          <div className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl py-16 text-center px-6">
            <Banknote className="w-10 h-10 text-stone-200 dark:text-white/10 mx-auto mb-3" />
            <p className="font-semibold text-stone-700 dark:text-white/70 mb-1">No applications yet</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4 md:hidden">
            {displayed.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                currency={currency}
                canApprove={Boolean(poolSnap?.isApprover)}
                busyId={actionBusyId}
                onApprove={(l) => void onApproveLoan(l)}
                onReject={(l) => void onRejectLoan(l)}
              />
            ))}
          </div>
        )}

        {/* Desktop also show cards below table for richer AI detail */}
        {displayed.length > 0 && (
          <div className="hidden md:grid lg:grid-cols-2 xl:grid-cols-3 gap-4 mt-2">
            {displayed.slice(0, 6).map((loan) => (
              <LoanCard
                key={`card-${loan.id}`}
                loan={loan}
                currency={currency}
                canApprove={Boolean(poolSnap?.isApprover)}
                busyId={actionBusyId}
                onApprove={(l) => void onApproveLoan(l)}
                onReject={(l) => void onRejectLoan(l)}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

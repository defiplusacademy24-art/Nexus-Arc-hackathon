import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Banknote, Clock, CheckCircle2, XCircle, TrendingUp, Sparkles,
  Loader2, Shield, AlertTriangle, RefreshCcw, ArrowDownToLine,
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
} from '@/services/cooperative/loans';
import {
  evaluateLoanApplication,
  decisionBadgeLabel,
} from '@/services/cooperative/lending-agent';
import { getMemberByWallet, loadMembersInPayoutOrder } from '@/services/cooperative/members';
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

const PERIODS: { months: number; label: string }[] = [
  { months: 1, label: '1 month' },
  { months: 2, label: '2 months' },
  { months: 3, label: '3 months' },
  { months: 6, label: '6 months' },
];

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
              AI Lending Agent Assessment
            </h3>
            <p className="text-[11px] text-stone-400 dark:text-white/40">
              Autonomous underwriting · contribution, treasury & policy rules
            </p>
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
            Approved by AI Lending Agent
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5289B8] dark:text-[#77A6DB] bg-[#6393C4]/10 border border-[#6393C4]/20 px-3 py-1.5 rounded-full">
            <Banknote className="w-3.5 h-3.5" />
            Disbursement Ready
          </span>
          <p className="w-full text-[11px] text-stone-400 dark:text-white/35 mt-1">
            Future integration will transfer USDC automatically on Arc.
          </p>
        </div>
      )}
    </motion.div>
  );
}

function LoanCard({ loan, currency }: { loan: Loan; currency: string }) {
  const config = STATUS_CONFIG[loan.status];
  const Icon = config.icon;
  const statusLabel =
    loan.aiDecision ? decisionBadgeLabel(loan.aiDecision) : config.label;
  const principal = loan.approvedAmount ?? loan.requestedAmount;
  const paid = loan.paidAmount ?? 0;
  const remaining = remainingBalance(loan);
  const progress =
    principal > 0 ? Math.round((paid / principal) * 100) : undefined;

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
          {formatCurrency(loan.approvedAmount ?? loan.requestedAmount, currency)}
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
          <p className="text-[10px] text-stone-400 dark:text-white/30 mb-0.5">Repayment</p>
          <p className="font-semibold text-stone-800 dark:text-white">{loan.repaymentMonths} mo</p>
        </div>
        <div className="bg-stone-50 dark:bg-[#2E3B4B]/35 rounded-lg px-2.5 py-2">
          <p className="text-[10px] text-stone-400 dark:text-white/30 mb-0.5">AI Risk</p>
          <p className={cn('font-semibold', riskColor(loan.riskScore))}>
            {loan.riskLevel ?? riskLabel(loan.riskScore)} Risk
          </p>
        </div>
        <div className="bg-stone-50 dark:bg-[#2E3B4B]/35 rounded-lg px-2.5 py-2">
          <p className="text-[10px] text-stone-400 dark:text-white/30 mb-0.5">Status</p>
          <p className="font-semibold text-stone-800 dark:text-white">{statusLabel}</p>
        </div>
      </div>

      {progress !== undefined && (paid > 0 || isOutstandingLoan(loan)) && principal > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-stone-400 dark:text-white/40">Repaid</span>
            <span className="font-semibold text-stone-700 dark:text-white/80">
              {formatCurrency(paid, currency)} / {formatCurrency(principal, currency)}
            </span>
          </div>
          <div className="h-2 bg-stone-100 dark:bg-white/8 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          {loan.dueDate && isOutstandingLoan(loan) && (
            <p className="text-[10px] text-stone-400 dark:text-white/30 mt-1">
              Due {formatDate(loan.dueDate)}
            </p>
          )}
        </div>
      )}

      {loan.disbursementReady && loan.status === 'approved' && (
        <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mb-2">
          <CheckCircle2 className="w-3.5 h-3.5" /> Disbursement Ready
        </div>
      )}

      {loan.aiRecommendation && (
        <div className="bg-[#6393C4]/5 dark:bg-[#6393C4]/8 border border-[#6393C4]/12 rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3 h-3 text-[#6393C4]" />
            <span className="text-[10px] font-semibold text-[#6393C4] uppercase tracking-wide">
              AI Lending Agent
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
  months: 2,
  reason: '',
  agreed: false,
};

export default function Loans() {
  const { activeCooperative, updateCooperative, refresh } = useCooperative();
  const { walletAddress, identity } = useWallet();
  const [tab, setTab] = useState<FilterTab>('all');
  const [loans, setLoans] = useState<Loan[]>([]);
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

  const reload = useCallback(() => {
    setLoans(activeCooperative ? loadLoans(activeCooperative.id) : []);
  }, [activeCooperative]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const onUpd = (ev: Event) => {
      const id = (ev as CustomEvent<{ cooperativeId?: string }>).detail?.cooperativeId;
      if (!activeCooperative || (id && id !== activeCooperative.id)) return;
      reload();
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

  const submitRepayment = () => {
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
      const result = applyLoanRepayment(
        activeCooperative.id,
        loan.id,
        amount,
        walletAddress,
      );

      // Only restore cash if this loan originally reduced treasury (cashDisbursedFromTreasury).
      // Otherwise outstanding falls but cash is unchanged — never inflate the total.
      if (result.cashToRestore > 0) {
        const nextTreasury =
          Math.round(
            ((activeCooperative.treasuryBalance ?? 0) + result.cashToRestore) * 100,
          ) / 100;
        updateCooperative(activeCooperative.id, { treasuryBalance: nextTreasury });
        refresh();
      }

      setLoans(loadLoans(activeCooperative.id));
      setRepayAmount('');
      if (result.fullyPaid) {
        setRepaySuccess(
          result.cashToRestore > 0
            ? `Fully repaid ${formatCurrency(result.amountPaid, currency)}. Cash restored to treasury. Loan closed.`
            : `Fully repaid ${formatCurrency(result.amountPaid, currency)}. Loan closed (removed from outstanding).`,
        );
        setRepayLoanId('');
      } else {
        setRepaySuccess(
          result.cashToRestore > 0
            ? `Paid ${formatCurrency(result.amountPaid, currency)} (cash restored). Still owed ${formatCurrency(result.remaining, currency)}.`
            : `Paid ${formatCurrency(result.amountPaid, currency)}. Still owed ${formatCurrency(result.remaining, currency)}.`,
        );
      }
    } catch (e) {
      setRepayError(e instanceof Error ? e.message : 'Repayment failed.');
    } finally {
      setRepaying(false);
    }
  };

  const submitApplication = async () => {
    setFormError('');
    setAssessment(null);
    setLastCreated(null);

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
    // Simulate autonomous AI evaluation (2–3s)
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

    // Disburse only when approved AND cash is available — deduct first, then create loan with flag.
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
            Create or join a cooperative to apply for loans and run the AI Lending Agent.
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
              {formatCurrency(outstanding, currency)} receivable ·{' '}
              {formatCurrency(activeCooperative.treasuryBalance ?? 0, currency)} cash on hand
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
              label: 'Total Disbursed',
              value: formatCurrency(disbursed, currency),
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
                <p className="text-xs text-stone-400 dark:text-white/40 mt-1 max-w-2xl leading-relaxed">
                  Pay in full or in parts before the due date. When the loan was approved, cash left the treasury;
                  each repayment returns that cash. Outstanding is what you still owe — not double-counted as cash.
                </p>
              </div>
            </div>

            <div className="mb-5 rounded-xl border border-stone-100 dark:border-white/8 bg-stone-50 dark:bg-[#2E3B4B]/30 px-4 py-3 text-[11px] text-stone-500 dark:text-white/45 leading-relaxed">
              <p className="font-semibold text-stone-600 dark:text-white/60 mb-1">How the numbers work</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li><strong className="text-stone-700 dark:text-white/70">Approve</strong> — cash leaves the treasury (e.g. $70 → $65 if $5 lent).</li>
                <li><strong className="text-stone-700 dark:text-white/70">Outstanding</strong> — what the member still owes (receivable), not extra cash.</li>
                <li><strong className="text-stone-700 dark:text-white/70">Repay</strong> — cash comes back only if it left on approve. Outstanding always falls.</li>
              </ol>
            </div>

            {!walletAddress ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Connect your wallet to see and repay your loans.
              </p>
            ) : myOutstanding.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-stone-200 dark:border-white/10 rounded-xl">
                <CheckCircle2 className="w-8 h-8 text-emerald-400/80 mx-auto mb-2" />
                <p className="text-sm font-semibold text-stone-700 dark:text-white/70">No outstanding loans</p>
                <p className="text-xs text-stone-400 dark:text-white/35 mt-1">
                  When you have an approved loan with a remaining balance, it will appear here.
                </p>
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

                {selectedRepayLoan && (
                  <div className="rounded-xl border border-stone-100 dark:border-white/8 bg-stone-50/80 dark:bg-[#2E3B4B]/25 p-4">
                    <p className="text-xs font-semibold text-stone-500 dark:text-white/50 uppercase tracking-wide mb-3">
                      Make a payment
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 mb-3">
                      <div className="flex-1 space-y-1.5">
                        <label className="text-[11px] text-stone-400 dark:text-white/40">
                          Amount (max {formatCurrency(remainingBalance(selectedRepayLoan), currency)})
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
                      <div className="flex items-end gap-2">
                        <button
                          type="button"
                          disabled={repaying}
                          onClick={() =>
                            setRepayAmount(String(remainingBalance(selectedRepayLoan)))
                          }
                          className="px-3 py-2.5 rounded-xl border border-stone-200 dark:border-white/10 text-xs font-semibold text-stone-600 dark:text-white/60 hover:bg-white dark:hover:bg-white/5 transition-colors"
                        >
                          Pay full balance
                        </button>
                        <button
                          type="button"
                          disabled={repaying}
                          onClick={submitRepayment}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-60 transition-colors"
                        >
                          {repaying ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCcw className="w-4 h-4" />
                          )}
                          Confirm repayment
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
                    <p className="text-[11px] text-stone-400 dark:text-white/30 mt-3">
                      Partial payments allowed. Each payment: cash on hand ↑ and outstanding ↓ by the same amount. Full repayment closes the loan.
                    </p>
                  </div>
                )}
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
              <p className="text-xs text-stone-400 dark:text-white/40 mt-1 max-w-2xl leading-relaxed">
                Request a cooperative loan. AI agents will evaluate your application using your
                contribution history, treasury health, cooperative reputation, and lending rules.
              </p>
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
                placeholder="e.g. 200"
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
                placeholder="Explain how you will use the funds and repay on schedule…"
                className="w-full bg-stone-50 dark:bg-[#2E3B4B]/40 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-white placeholder:text-stone-400 outline-none focus:border-[#6393C4]/50 focus:ring-2 focus:ring-[#6393C4]/10 resize-none disabled:opacity-60"
              />
            </div>
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
                <div>
                  <p className="text-sm font-semibold text-[#5289B8] dark:text-[#77A6DB]">
                    Lending Agent is evaluating your request…
                  </p>
                  <p className="text-[11px] text-stone-400 dark:text-white/35 mt-0.5">
                    Checking contribution history, treasury health, reputation, and lending policy
                  </p>
                </div>
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
            <p className="font-semibold text-stone-700 dark:text-white/70 mb-1">No loan applications yet</p>
            <p className="text-sm text-stone-400 dark:text-white/40 max-w-md mx-auto">
              Submit a request above. The AI Lending Agent will underwrite using live cooperative data.
            </p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4 md:hidden">
            {displayed.map((loan) => (
              <LoanCard key={loan.id} loan={loan} currency={currency} />
            ))}
          </div>
        )}

        {/* Desktop also show cards below table for richer AI detail */}
        {displayed.length > 0 && (
          <div className="hidden md:grid lg:grid-cols-2 xl:grid-cols-3 gap-4 mt-2">
            {displayed.slice(0, 6).map((loan) => (
              <LoanCard key={`card-${loan.id}`} loan={loan} currency={currency} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

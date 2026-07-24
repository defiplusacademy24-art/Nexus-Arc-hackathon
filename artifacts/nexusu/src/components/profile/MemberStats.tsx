import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Banknote, PiggyBank, Vote, Calendar } from 'lucide-react';
import { useCooperative } from '@/providers/CooperativeProvider';
import { useWallet } from '@/providers/WalletProvider';
import { loadMembersInPayoutOrder } from '@/services/cooperative/members';
import { loadLoans } from '@/services/cooperative/loans';
import { loadProposals } from '@/services/cooperative/proposals';
import { formatCurrency } from '@/utils/format';

interface MemberStatsProps {
  delay?: number;
}

export function MemberStats({ delay = 0 }: MemberStatsProps) {
  const { activeCooperative } = useCooperative();
  const { walletAddress } = useWallet();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setTick((t) => t + 1);
  }, [activeCooperative?.id, walletAddress]);

  const stats = useMemo(() => {
    void tick;
    if (!activeCooperative) {
      return [
        { label: 'Total Contributions', value: formatCurrency(0), subLabel: 'No cooperative', icon: TrendingUp, color: 'text-emerald-500' },
        { label: 'Savings Balance', value: formatCurrency(0), subLabel: 'No pools', icon: PiggyBank, color: 'text-sky-500' },
        { label: 'Loans Taken', value: '0', subLabel: formatCurrency(0) + ' total', icon: Banknote, color: 'text-[#77A6DB]' },
        { label: 'Repayment Rate', value: '—', subLabel: 'No loans', icon: BarChart3, color: 'text-[#6393C4]' },
        { label: 'Governance Votes', value: '0', subLabel: 'No proposals', icon: Vote, color: 'text-purple-500' },
        { label: 'Payout Position', value: '—', subLabel: 'Not joined', icon: Calendar, color: 'text-teal-500' },
      ];
    }

    const members = loadMembersInPayoutOrder(activeCooperative.id);
    const me = walletAddress
      ? members.find((m) => m.walletIdentity.toLowerCase() === walletAddress.toLowerCase())
      : null;
    const contributed = me?.totalContributed ?? 0;
    const loans = loadLoans(activeCooperative.id).filter(
      (l) =>
        me &&
        (l.borrowerId === me.id ||
          l.borrowerName === me.name),
    );
    const loanTotal = loans.reduce((s, l) => s + (l.approvedAmount ?? l.requestedAmount ?? 0), 0);
    const proposals = loadProposals(activeCooperative.id);
    const currency = activeCooperative.currency ?? 'USD';

    return [
      {
        label: 'Total Contributions',
        value: formatCurrency(contributed, currency),
        subLabel: me ? 'Your ledger total' : 'Connect wallet',
        icon: TrendingUp,
        color: 'text-emerald-500',
      },
      {
        label: 'Savings Balance',
        value: formatCurrency(0, currency),
        subLabel: 'Pools when funded',
        icon: PiggyBank,
        color: 'text-sky-500',
      },
      {
        label: 'Loans Taken',
        value: String(loans.length),
        subLabel: `${formatCurrency(loanTotal, currency)} total`,
        icon: Banknote,
        color: 'text-[#77A6DB]',
      },
      {
        label: 'Repayment Rate',
        value: loans.length === 0 ? '—' : '0%',
        subLabel: loans.length === 0 ? 'No loans' : 'From repayments',
        icon: BarChart3,
        color: 'text-[#6393C4]',
      },
      {
        label: 'Governance Votes',
        value: '0',
        subLabel: `${proposals.length} proposal${proposals.length === 1 ? '' : 's'} on record`,
        icon: Vote,
        color: 'text-purple-500',
      },
      {
        label: 'Payout Position',
        value: me?.joinPosition != null ? `#${me.joinPosition}` : '—',
        subLabel: me ? 'Join order' : 'Not a member',
        icon: Calendar,
        color: 'text-teal-500',
      },
    ];
  }, [activeCooperative, walletAddress, tick]);

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
        {stats.map((stat) => {
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

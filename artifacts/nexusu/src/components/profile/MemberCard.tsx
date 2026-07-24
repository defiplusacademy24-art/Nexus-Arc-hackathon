import { motion } from 'framer-motion';
import { Building2, Calendar, Hash, TrendingUp, Vote, Shield, CheckCircle2 } from 'lucide-react';
import { useCooperative } from '@/providers/CooperativeProvider';
import { loadMembersInPayoutOrder } from '@/services/cooperative/members';
import { useWallet } from '@/providers/WalletProvider';
import { formatCurrency, formatDate, roleLabel } from '@/utils/format';
import { useMemo } from 'react';

interface MemberCardProps {
  delay?: number;
}

export function MemberCard({ delay = 0 }: MemberCardProps) {
  const { activeCooperative } = useCooperative();
  const { walletAddress } = useWallet();

  const membership = useMemo(() => {
    if (!activeCooperative) return null;
    const members = loadMembersInPayoutOrder(activeCooperative.id);
    if (!walletAddress) return members[0] ?? null;
    return (
      members.find(
        (m) => m.walletIdentity.toLowerCase() === walletAddress.toLowerCase(),
      ) ?? null
    );
  }, [activeCooperative?.id, walletAddress]);

  if (!activeCooperative) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.35 }}
        className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5"
      >
        <div className="flex items-center gap-2.5 mb-3">
          <Building2 className="w-4 h-4 text-[#6393C4]" />
          <span className="text-sm font-semibold text-stone-800 dark:text-white">
            Cooperative Membership
          </span>
        </div>
        <p className="text-xs text-stone-400 dark:text-white/40">
          Create or join a cooperative to see membership details.
        </p>
      </motion.div>
    );
  }

  const initials = activeCooperative.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const details = [
    { label: 'Cooperative', value: activeCooperative.name, icon: Building2 },
    {
      label: 'Role',
      value: membership ? roleLabel(membership.role) : 'Member',
      icon: Shield,
    },
    {
      label: 'Member Since',
      value: membership?.joinedAt ? formatDate(membership.joinedAt) : formatDate(activeCooperative.createdAt),
      icon: Calendar,
    },
    {
      label: 'Payout Position',
      value: membership?.joinPosition != null ? `#${membership.joinPosition}` : '—',
      icon: Hash,
    },
    {
      label: 'Contribution',
      value: `${formatCurrency(activeCooperative.contributionAmount, activeCooperative.currency)} / ${activeCooperative.contributionFrequency}`,
      icon: TrendingUp,
    },
    {
      label: 'Voting Power',
      value: membership?.role === 'founder' || membership?.role === 'admin'
        ? '1 vote · admin rights'
        : '1 vote · full rights',
      icon: Vote,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-stone-100 dark:border-[#1A2A3A] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Building2 className="w-4 h-4 text-[#6393C4]" />
          <span className="text-sm font-semibold text-stone-800 dark:text-white">
            Cooperative Membership
          </span>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          {membership?.status === 'active' || !membership ? 'Active' : membership.status}
        </span>
      </div>

      <div className="mx-5 mt-4 p-4 rounded-xl bg-gradient-to-r from-[#6393C4]/8 to-[#77A6DB]/5 border border-[#6393C4]/12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6393C4] to-[#77A6DB] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{initials}</span>
          </div>
          <div>
            <p className="text-sm font-bold text-stone-800 dark:text-white">{activeCooperative.name}</p>
            <p className="text-xs text-stone-500 dark:text-white/45">
              {activeCooperative.type}
              {activeCooperative.country ? ` · ${activeCooperative.country}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-3 pb-1">
        {details.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="py-3 border-b border-stone-100 dark:border-white/5 last:border-0 flex items-center gap-3"
          >
            <Icon className="w-3.5 h-3.5 text-stone-400 dark:text-white/30 flex-shrink-0" />
            <span className="text-xs text-stone-400 dark:text-white/40 flex-1">{label}</span>
            <span className="text-xs font-semibold text-stone-700 dark:text-white/80 text-right">
              {value}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

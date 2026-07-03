import { motion } from 'framer-motion';
import { Building2, Calendar, Hash, TrendingUp, Vote, Shield, CheckCircle2 } from 'lucide-react';
import { DEMO_COOPERATIVE } from '@/lib/demo-data';

interface MemberCardProps {
  delay?: number;
}

const MEMBER_DETAILS = [
  { label: 'Cooperative',       value: DEMO_COOPERATIVE.name,               icon: Building2 },
  { label: 'Role',              value: 'Founder & Admin',                   icon: Shield },
  { label: 'Member Since',      value: 'January 15, 2024',                  icon: Calendar },
  { label: 'Member ID',         value: '#M-001',                            icon: Hash },
  { label: 'Contribution',      value: `$${DEMO_COOPERATIVE.contributionAmount} / ${DEMO_COOPERATIVE.contributionFrequency}`, icon: TrendingUp },
  { label: 'Voting Power',      value: '1 vote · full rights',              icon: Vote },
];

export function MemberCard({ delay = 0 }: MemberCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-white/6 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-stone-100 dark:border-white/6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Building2 className="w-4 h-4 text-[#E8461E]" />
          <span className="text-sm font-semibold text-stone-800 dark:text-white">
            Cooperative Membership
          </span>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          Active
        </span>
      </div>

      {/* Cooperative banner */}
      <div className="mx-5 mt-4 p-4 rounded-xl bg-gradient-to-r from-[#E8461E]/8 to-[#F97316]/5 border border-[#E8461E]/12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E8461E] to-[#F97316] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">SS</span>
          </div>
          <div>
            <p className="text-sm font-bold text-stone-800 dark:text-white">{DEMO_COOPERATIVE.name}</p>
            <p className="text-xs text-stone-500 dark:text-white/45">
              {DEMO_COOPERATIVE.type} · {DEMO_COOPERATIVE.country}
            </p>
          </div>
        </div>
      </div>

      {/* Detail rows */}
      <div className="px-5 mt-3 pb-1">
        {MEMBER_DETAILS.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="py-3 border-b border-stone-100 dark:border-white/5 last:border-0 flex items-center gap-3"
          >
            <div className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
              <Icon className="w-3.5 h-3.5 text-stone-400 dark:text-white/35" />
            </div>
            <div className="flex-1 flex items-center justify-between gap-2">
              <p className="text-xs text-stone-400 dark:text-white/35">{label}</p>
              <p className="text-xs font-semibold text-stone-700 dark:text-white/75 text-right">
                {value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Treasury access */}
      <div className="mx-5 mb-5 mt-2 p-3 rounded-xl bg-stone-50 dark:bg-white/3 border border-stone-100 dark:border-white/6 flex items-center gap-2">
        <Shield className="w-3.5 h-3.5 text-[#E8461E] flex-shrink-0" />
        <p className="text-xs text-stone-500 dark:text-white/45">
          <span className="font-semibold text-stone-700 dark:text-white/70">Treasury access</span>
          {' '}· Read + propose disbursements
        </p>
      </div>
    </motion.div>
  );
}

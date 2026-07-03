import { motion } from 'framer-motion';
import { Activity, Wallet, ShieldCheck, Zap, FileText, Banknote, PiggyBank } from 'lucide-react';
import { loadIdentity } from '@/services/unicity/session';

interface TimelineEvent {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'wallet' | 'contribution' | 'loan' | 'governance' | 'system';
}

function buildEvents(): TimelineEvent[] {
  const stored = loadIdentity();
  const connectedAt = stored?.connectedAt
    ? new Date(stored.connectedAt).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : 'This session';

  const sessionEvents: TimelineEvent[] = [
    {
      id: 'wallet-connected',
      icon: Wallet,
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-50 dark:bg-emerald-500/10',
      title: 'Wallet Connected',
      description: 'Sphere wallet authenticated via Unicity Network',
      timestamp: connectedAt,
      type: 'wallet',
    },
    {
      id: 'identity-verified',
      icon: ShieldCheck,
      iconColor: 'text-[#E8461E]',
      iconBg: 'bg-red-50 dark:bg-[#E8461E]/10',
      title: 'Identity Verified',
      description: 'Non-custodial identity confirmed on testnet2',
      timestamp: connectedAt,
      type: 'wallet',
    },
  ];

  const coopEvents: TimelineEvent[] = [
    {
      id: 'contribution-1',
      icon: PiggyBank,
      iconColor: 'text-sky-500',
      iconBg: 'bg-sky-50 dark:bg-sky-500/10',
      title: 'Contribution Paid',
      description: '$350 monthly contribution to Sunshine Cooperative',
      timestamp: 'Jul 1, 2026',
      type: 'contribution',
    },
    {
      id: 'proposal-signed',
      icon: FileText,
      iconColor: 'text-purple-500',
      iconBg: 'bg-purple-50 dark:bg-purple-500/10',
      title: 'Proposal Voted',
      description: 'Voted on Emergency Fund Increase — Approved',
      timestamp: 'Jun 28, 2026',
      type: 'governance',
    },
    {
      id: 'loan-repayment',
      icon: Banknote,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-50 dark:bg-amber-500/10',
      title: 'Loan Repayment',
      description: '$250 instalment on $3,000 inventory loan',
      timestamp: 'Jun 15, 2026',
      type: 'loan',
    },
    {
      id: 'nexa-insight',
      icon: Zap,
      iconColor: 'text-[#E8461E]',
      iconBg: 'bg-red-50 dark:bg-[#E8461E]/10',
      title: 'Nexa AI Insight',
      description: 'Treasury projected to reach $60K by September',
      timestamp: 'Jun 10, 2026',
      type: 'system',
    },
  ];

  return [...sessionEvents, ...coopEvents];
}

interface ActivityTimelineProps {
  delay?: number;
}

export function ActivityTimeline({ delay = 0 }: ActivityTimelineProps) {
  const events = buildEvents();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-white/6 rounded-2xl overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-stone-100 dark:border-white/6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-[#E8461E]" />
          <span className="text-sm font-semibold text-stone-800 dark:text-white">
            Recent Activity
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
          />
          <span className="text-[10px] text-stone-400 dark:text-white/30 font-medium">Live</span>
        </div>
      </div>

      <div className="p-5">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[18px] top-3 bottom-3 w-px bg-stone-100 dark:bg-white/6" />

          <div className="space-y-5">
            {events.map((event, i) => {
              const Icon = event.icon;
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: delay + i * 0.05, duration: 0.3 }}
                  className="flex items-start gap-4 relative"
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 relative z-10 ${event.iconBg} border border-stone-100 dark:border-white/8`}
                  >
                    <Icon className={`w-4 h-4 ${event.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-stone-800 dark:text-white leading-tight">
                        {event.title}
                      </p>
                      <span className="text-[10px] text-stone-400 dark:text-white/25 whitespace-nowrap flex-shrink-0">
                        {event.timestamp}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 dark:text-white/40 mt-0.5 leading-relaxed">
                      {event.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

import { motion } from 'framer-motion';
import {
  Activity, Wallet, ShieldCheck, Banknote, PiggyBank,
  Users, Vault, AlertTriangle, Scale, Sparkles,
  ArrowDownLeft, ArrowUpRight, Bell,
} from 'lucide-react';
import { loadIdentity } from '@/services/wallet/session';
import { useNotifications } from '@/hooks/useNotifications';
import { formatRelative } from '@/utils/format';
import type { NotifType } from '@/types';

interface TimelineEvent {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  timestamp: string;
}

const TYPE_STYLE: Record<NotifType, { icon: React.ElementType; iconColor: string; iconBg: string }> = {
  contribution: { icon: PiggyBank, iconColor: 'text-sky-500', iconBg: 'bg-sky-50 dark:bg-sky-500/10' },
  deposit: { icon: ArrowDownLeft, iconColor: 'text-emerald-500', iconBg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  withdrawal: { icon: ArrowUpRight, iconColor: 'text-amber-500', iconBg: 'bg-amber-50 dark:bg-amber-500/10' },
  loan: { icon: Banknote, iconColor: 'text-[#6393C4]', iconBg: 'bg-[#6393C4]/8 dark:bg-[#6393C4]/10' },
  proposal: { icon: Scale, iconColor: 'text-purple-500', iconBg: 'bg-purple-50 dark:bg-purple-500/10' },
  vote: { icon: Scale, iconColor: 'text-purple-500', iconBg: 'bg-purple-50 dark:bg-purple-500/10' },
  member: { icon: Users, iconColor: 'text-[#6393C4]', iconBg: 'bg-[#6393C4]/10 dark:bg-[#6393C4]/10' },
  ai: { icon: Sparkles, iconColor: 'text-[#6393C4]', iconBg: 'bg-red-50 dark:bg-[#6393C4]/10' },
  treasury: { icon: Vault, iconColor: 'text-teal-500', iconBg: 'bg-teal-50 dark:bg-teal-500/10' },
  warning: { icon: AlertTriangle, iconColor: 'text-amber-500', iconBg: 'bg-amber-50 dark:bg-amber-500/10' },
};

function buildSessionEvents(): TimelineEvent[] {
  const stored = loadIdentity();
  const connectedAt = stored?.connectedAt
    ? new Date(stored.connectedAt).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : null;

  if (!connectedAt) return [];

  return [
    {
      id: 'wallet-connected',
      icon: Wallet,
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-50 dark:bg-emerald-500/10',
      title: 'Wallet Connected',
      description: 'Wallet connected on Arc Testnet',
      timestamp: connectedAt,
    },
    {
      id: 'identity-verified',
      icon: ShieldCheck,
      iconColor: 'text-[#6393C4]',
      iconBg: 'bg-red-50 dark:bg-[#6393C4]/10',
      title: 'Identity Verified',
      description: 'Non-custodial identity confirmed on Arc',
      timestamp: connectedAt,
    },
  ];
}

interface ActivityTimelineProps {
  delay?: number;
}

export function ActivityTimeline({ delay = 0 }: ActivityTimelineProps) {
  const { notifications, live } = useNotifications();

  const notifEvents: TimelineEvent[] = notifications.slice(0, 12).map((n) => {
    const style = TYPE_STYLE[n.type] ?? TYPE_STYLE.ai;
    return {
      id: n.id,
      icon: style.icon,
      iconColor: style.iconColor,
      iconBg: style.iconBg,
      title: n.title,
      description: n.description,
      timestamp: formatRelative(n.timestamp),
    };
  });

  const events = [...notifEvents, ...buildSessionEvents()];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-stone-100 dark:border-[#1A2A3A] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-[#6393C4]" />
          <span className="text-sm font-semibold text-stone-800 dark:text-white">
            Recent Activity
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <motion.div
            animate={{ opacity: live ? [1, 0.3, 1] : 0.4 }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-emerald-400' : 'bg-stone-300'}`}
          />
          <span className="text-[10px] text-stone-400 dark:text-white/30 font-medium">
            {live ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="p-5">
        {events.length === 0 ? (
          <div className="py-10 text-center">
            <Bell className="w-8 h-8 text-stone-200 dark:text-white/10 mx-auto mb-2" />
            <p className="text-xs text-stone-400 dark:text-white/35">
              No activity yet. Your deposits, withdrawals, and cooperative events will appear here.
            </p>
          </div>
        ) : (
          <div className="relative">
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
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 relative z-10 ${event.iconBg} border border-stone-100 dark:border-[#1A2A3A]`}
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
        )}
      </div>
    </motion.div>
  );
}

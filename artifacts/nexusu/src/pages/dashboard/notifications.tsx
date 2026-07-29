import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, CheckCircle2, Banknote, Scale, Users,
  Sparkles, Vault, AlertTriangle, Check, ArrowDownLeft, ArrowUpRight,
  Loader2, Radio, RefreshCw, ArrowLeftRight, Settings2,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { useNotifications } from '@/hooks/useNotifications';
import { useWallet } from '@/providers/WalletProvider';
import { partitionNotifications } from '@/services/notifications/categories';
import { formatRelative } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { AppNotification, NotifType } from '@/types';
import { Link } from 'wouter';

const NOTIF_ICONS: Record<NotifType, React.ElementType> = {
  contribution: CheckCircle2,
  deposit: ArrowDownLeft,
  withdrawal: ArrowUpRight,
  loan: Banknote,
  proposal: Scale,
  vote: Scale,
  member: Users,
  ai: Sparkles,
  treasury: Vault,
  warning: AlertTriangle,
};

const NOTIF_COLORS: Record<NotifType, string> = {
  contribution: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
  deposit: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
  withdrawal: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10',
  loan: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
  proposal: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10',
  vote: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10',
  member: 'text-[#6393C4] bg-[#6393C4]/10 dark:bg-[#6393C4]/10',
  ai: 'text-[#6393C4] bg-[#6393C4]/8 dark:bg-[#6393C4]/12',
  treasury: 'text-teal-500 bg-teal-50 dark:bg-teal-500/10',
  warning: 'text-[#6393C4] bg-[#6393C4]/8 dark:bg-[#6393C4]/10',
};

function NotifItem({ notif, onRead }: { notif: AppNotification; onRead: (id: string) => void }) {
  const Icon = NOTIF_ICONS[notif.type] ?? Bell;
  const color = NOTIF_COLORS[notif.type] ?? NOTIF_COLORS.ai;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        'flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border transition-all min-w-0',
        notif.read
          ? 'bg-white dark:bg-stone-900/40 border-stone-100 dark:border-white/4'
          : 'bg-[#6393C4]/3 dark:bg-[#6393C4]/5 border-[#6393C4]/15 dark:border-[#6393C4]/12',
      )}
    >
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', color.split(' ').slice(1).join(' '))}>
        <Icon className={cn('w-4 h-4', color.split(' ')[0])} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 min-w-0">
          <p className="text-sm font-semibold text-stone-800 dark:text-white truncate">{notif.title}</p>
          {!notif.read && (
            <span className="w-2 h-2 rounded-full bg-[#6393C4] flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-stone-500 dark:text-white/50 leading-relaxed">{notif.description}</p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-[11px] text-stone-300 dark:text-white/25">{formatRelative(notif.timestamp)}</span>
          {notif.actionLabel && notif.actionHref && (
            <Link href={notif.actionHref} className="text-[11px] font-semibold text-[#6393C4] hover:underline">
              {notif.actionLabel}
            </Link>
          )}
          {notif.actionLabel && !notif.actionHref && (
            <span className="text-[11px] font-semibold text-[#6393C4]">{notif.actionLabel}</span>
          )}
        </div>
      </div>
      {!notif.read && (
        <button
          type="button"
          onClick={() => onRead(notif.id)}
          className="flex-shrink-0 p-1.5 rounded-lg text-stone-300 dark:text-white/20 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
          title="Mark as read"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  );
}

type Tab = 'transactions' | 'systems';

export default function Notifications() {
  const { isConnected } = useWallet();
  const {
    notifications: notifs,
    unreadCount,
    loading,
    error,
    live,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications();
  const [tab, setTab] = useState<Tab>('transactions');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { transactions, systems } = useMemo(
    () => partitionNotifications(notifs),
    [notifs],
  );

  const activeList = tab === 'transactions' ? transactions : systems;
  const displayed = unreadOnly ? activeList.filter((n) => !n.read) : activeList;

  const txUnread = transactions.filter((n) => !n.read).length;
  const sysUnread = systems.filter((n) => !n.read).length;

  const tabs: {
    id: Tab;
    label: string;
    icon: React.ElementType;
    count: number;
    unread: number;
    hint: string;
  }[] = [
    {
      id: 'transactions',
      label: 'Transactions',
      icon: ArrowLeftRight,
      count: transactions.length,
      unread: txUnread,
      hint: 'On-chain deposits, withdrawals, and contributions',
    },
    {
      id: 'systems',
      label: 'Systems',
      icon: Settings2,
      count: systems.length,
      unread: sysUnread,
      hint: 'Cooperative, membership, governance, and platform alerts',
    },
  ];

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 py-5 sm:py-6 max-w-3xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-7"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-display font-bold text-stone-900 dark:text-white">Notifications</h1>
              {live && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <Radio className="w-3 h-3" /> Live
                </span>
              )}
            </div>
            <p className="text-sm text-stone-400 dark:text-white/40 mt-0.5">
              {!isConnected
                ? 'Connect your wallet to receive notifications'
                : unreadCount > 0
                  ? `${unreadCount} unread · your activity feed`
                  : 'All caught up · transaction history lives here'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => void refresh()}
              className="flex items-center justify-center gap-2 px-3 py-2.5 sm:py-2 rounded-xl border border-stone-200 dark:border-white/10 text-sm text-stone-500 dark:text-white/50 hover:border-stone-300 dark:hover:border-white/20 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl border border-stone-200 dark:border-white/10 text-sm text-stone-500 dark:text-white/50 hover:border-stone-300 dark:hover:border-white/20 transition-colors whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>
        </motion.div>

        {error && (
          <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            {error}
          </div>
        )}

        {/* Category tabs: Transactions | Systems */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.08 }}
          className="grid grid-cols-2 gap-3 mb-4"
        >
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'text-left rounded-2xl border p-4 transition-all',
                  active
                    ? 'border-[#6393C4] bg-[#6393C4]/5 dark:bg-[#6393C4]/10 shadow-sm'
                    : 'border-stone-200 dark:border-[#1A2A3A] bg-white dark:bg-stone-900/40 hover:border-stone-300 dark:hover:border-white/15',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={cn('w-4 h-4', active ? 'text-[#6393C4]' : 'text-stone-400')} />
                  <span className={cn('text-sm font-bold', active ? 'text-[#6393C4]' : 'text-stone-800 dark:text-white')}>
                    {t.label}
                  </span>
                  <span className={cn(
                    'ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full',
                    active ? 'bg-[#6393C4] text-white' : 'bg-stone-100 dark:bg-white/8 text-stone-500 dark:text-white/40',
                  )}>
                    {t.count}
                  </span>
                  {t.unread > 0 && (
                    <span className="w-2 h-2 rounded-full bg-[#6393C4]" title={`${t.unread} unread`} />
                  )}
                </div>
                <p className="text-[11px] text-stone-400 dark:text-white/35 leading-snug">{t.hint}</p>
              </button>
            );
          })}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex gap-1 mb-5 bg-stone-100 dark:bg-[#2E3B4B]/40 rounded-xl p-1 w-fit">
          {([
            { id: false as const, label: 'All' },
            { id: true as const, label: `Unread${activeList.some((n) => !n.read) ? ` (${activeList.filter((n) => !n.read).length})` : ''}` },
          ]).map((f) => (
            <button
              key={String(f.id)}
              type="button"
              onClick={() => setUnreadOnly(f.id)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                unreadOnly === f.id
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm'
                  : 'text-stone-400 dark:text-white/40',
              )}
            >
              {f.label}
            </button>
          ))}
        </motion.div>

        {loading && notifs.length === 0 && (
          <div className="flex items-center justify-center py-16 text-stone-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading notifications…
          </div>
        )}

        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {displayed.map((notif) => (
              <NotifItem key={notif.id} notif={notif} onRead={(id) => void markRead(id)} />
            ))}
          </AnimatePresence>
        </div>

        {!loading && displayed.length === 0 && (
          <div className="text-center py-20">
            {tab === 'transactions' ? (
              <ArrowLeftRight className="w-10 h-10 text-stone-200 dark:text-white/10 mx-auto mb-3" />
            ) : (
              <Settings2 className="w-10 h-10 text-stone-200 dark:text-white/10 mx-auto mb-3" />
            )}
            <p className="text-stone-400 dark:text-white/40 text-sm">
              {!isConnected
                ? 'Connect a wallet to see notifications'
                : unreadOnly
                  ? `No unread ${tab === 'transactions' ? 'transactions' : 'system'} notifications`
                  : tab === 'transactions'
                    ? 'No transactions yet'
                    : 'No notifications yet'}
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

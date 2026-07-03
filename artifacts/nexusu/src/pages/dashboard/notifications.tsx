import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, CheckCircle2, Banknote, Scale, Users,
  Sparkles, Vault, AlertTriangle, Check, Trash2,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { DEMO_NOTIFICATIONS } from '@/lib/demo-data';
import { formatRelative } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { AppNotification, NotifType } from '@/types';

const NOTIF_ICONS: Record<NotifType, React.ElementType> = {
  contribution: CheckCircle2,
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
  loan: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
  proposal: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10',
  vote: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10',
  member: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10',
  ai: 'text-[#E8461E] bg-[#E8461E]/8 dark:bg-[#E8461E]/12',
  treasury: 'text-teal-500 bg-teal-50 dark:bg-teal-500/10',
  warning: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10',
};

function NotifItem({ notif, onRead }: { notif: AppNotification; onRead: (id: string) => void }) {
  const Icon = NOTIF_ICONS[notif.type];
  const color = NOTIF_COLORS[notif.type];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        'flex items-start gap-4 p-4 rounded-2xl border transition-all',
        notif.read
          ? 'bg-white dark:bg-stone-900/40 border-stone-100 dark:border-white/4'
          : 'bg-[#E8461E]/3 dark:bg-[#E8461E]/5 border-[#E8461E]/15 dark:border-[#E8461E]/12',
      )}
    >
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', color.split(' ').slice(1).join(' '))}>
        <Icon className={cn('w-4 h-4', color.split(' ')[0])} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-stone-800 dark:text-white truncate">{notif.title}</p>
          {!notif.read && (
            <span className="w-2 h-2 rounded-full bg-[#E8461E] flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-stone-500 dark:text-white/50 leading-relaxed">{notif.description}</p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-[11px] text-stone-300 dark:text-white/25">{formatRelative(notif.timestamp)}</span>
          {notif.actionLabel && (
            <a href={notif.actionHref ?? '#'} className="text-[11px] font-semibold text-[#E8461E] hover:underline">
              {notif.actionLabel}
            </a>
          )}
        </div>
      </div>
      {!notif.read && (
        <button
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

export default function Notifications() {
  const [notifs, setNotifs] = useState(DEMO_NOTIFICATIONS);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const markRead = (id: string) =>
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));

  const markAllRead = () =>
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));

  const displayed = filter === 'unread' ? notifs.filter((n) => !n.read) : notifs;
  const unreadCount = notifs.filter((n) => !n.read).length;

  return (
    <DashboardLayout>
      <div className="px-6 py-6 max-w-3xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-xl font-display font-bold text-stone-900 dark:text-white">Notifications</h1>
            <p className="text-sm text-stone-400 dark:text-white/40 mt-0.5">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-200 dark:border-white/10 text-sm text-stone-500 dark:text-white/50 hover:border-stone-300 dark:hover:border-white/20 transition-colors"
            >
              <Check className="w-3.5 h-3.5" /> Mark all read
            </button>
          )}
        </motion.div>

        {/* Filter */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex gap-1 mb-5 bg-stone-100 dark:bg-white/5 rounded-xl p-1 w-fit">
          {(['all', 'unread'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize',
                filter === f
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm'
                  : 'text-stone-400 dark:text-white/40',
              )}
            >
              {f} {f === 'unread' && unreadCount > 0 && `(${unreadCount})`}
            </button>
          ))}
        </motion.div>

        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {displayed.map((notif) => (
              <NotifItem key={notif.id} notif={notif} onRead={markRead} />
            ))}
          </AnimatePresence>
        </div>

        {displayed.length === 0 && (
          <div className="text-center py-20">
            <Bell className="w-10 h-10 text-stone-200 dark:text-white/10 mx-auto mb-3" />
            <p className="text-stone-400 dark:text-white/40 text-sm">No {filter === 'unread' ? 'unread' : ''} notifications</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

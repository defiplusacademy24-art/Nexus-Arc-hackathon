import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Users, Vault, Banknote,
  PiggyBank, Scale, Sparkles, Activity, ArrowRight,
  Clock, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { AreaChart } from '@/components/charts/AreaChart';
import { useCountUp } from '@/hooks/useCountUp';
import { useWallet } from '@/providers/WalletProvider';
import { formatCurrency, formatPercent, formatRelative, scoreColor } from '@/utils/format';
import { DEMO_COOPERATIVE, DEMO_NOTIFICATIONS, DEMO_LOANS } from '@/lib/demo-data';
import { CASH_FLOW_HISTORY } from '@/services/treasury';
import { AI_INSIGHTS } from '@/services/ai/nexa';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';

// ── Animated Stat Card ─────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  format?: 'currency' | 'number' | 'percent' | 'score';
  suffix?: string;
  prefix?: string;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  iconColor?: string;
  href?: string;
  delay?: number;
}

function StatCard({
  label, value, format = 'currency', suffix = '', prefix = '',
  change, changeLabel, icon: Icon, iconColor = 'text-[#6393C4]',
  href, delay = 0,
}: StatCardProps) {
  const count = useCountUp(value);

  const formatted = (() => {
    if (format === 'currency') return formatCurrency(count);
    if (format === 'percent') return `${count}%`;
    if (format === 'score') return `${count}/100`;
    return count.toLocaleString();
  })();

  const card = (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5 hover:shadow-md dark:hover:border-white/10 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center bg-stone-50 dark:bg-[#2E3B4B]/40 border border-stone-100 dark:border-[#1A2A3A]')}>
          <Icon className={cn('w-4.5 h-4.5', iconColor)} style={{ width: '1.125rem', height: '1.125rem' }} />
        </div>
        {change !== undefined && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full',
            change >= 0
              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
          )}>
            {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>

      <p className="text-2xl font-display font-bold text-stone-900 dark:text-white mb-1">
        {prefix}{formatted}{suffix}
      </p>
      <p className="text-xs text-stone-400 dark:text-white/40 font-medium">
        {label}
        {changeLabel && <span className="ml-1 text-stone-300 dark:text-white/25">· {changeLabel}</span>}
      </p>
    </motion.div>
  );

  if (href) return <Link href={href}>{card}</Link>;
  return card;
}

// ── Activity Item ──────────────────────────────────────────────────────────────

function ActivityItem({ notif }: { notif: typeof DEMO_NOTIFICATIONS[0] }) {
  const icons = {
    contribution: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
    loan: <Banknote className="w-3.5 h-3.5 text-blue-500" />,
    proposal: <Scale className="w-3.5 h-3.5 text-purple-500" />,
    vote: <Scale className="w-3.5 h-3.5 text-purple-500" />,
    member: <Users className="w-3.5 h-3.5 text-[#6393C4]" />,
    ai: <Sparkles className="w-3.5 h-3.5 text-[#6393C4]" />,
    treasury: <Vault className="w-3.5 h-3.5 text-teal-500" />,
    warning: <AlertCircle className="w-3.5 h-3.5 text-[#6393C4]" />,
  };

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-stone-50 dark:border-white/4 last:border-0">
      <div className="w-6 h-6 rounded-full bg-stone-50 dark:bg-[#2E3B4B]/40 flex items-center justify-center flex-shrink-0 mt-0.5">
        {icons[notif.type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-stone-700 dark:text-white/80 truncate">{notif.title}</p>
        <p className="text-[11px] text-stone-400 dark:text-white/35 truncate">{notif.description}</p>
      </div>
      <span className="text-[10px] text-stone-300 dark:text-white/25 flex-shrink-0 mt-0.5">
        {formatRelative(notif.timestamp)}
      </span>
    </div>
  );
}

// ── Overview Page ──────────────────────────────────────────────────────────────

export default function Overview() {
  const { identity } = useWallet();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const displayName = identity?.nametag ? `@${identity.nametag}` : identity?.displayName ?? 'there';

  const pending = DEMO_LOANS.filter((l) => l.status === 'pending').length;

  return (
    <DashboardLayout>
      <div className="px-6 py-6 max-w-7xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-7"
        >
          <h1 className="text-2xl font-display font-bold text-stone-900 dark:text-white">
            {greeting}, {displayName} 👋
          </h1>
          <p className="text-sm text-stone-400 dark:text-white/40 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {' · '}{DEMO_COOPERATIVE.name}
          </p>
        </motion.div>

        {/* Stat cards — 4 columns */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Treasury" value={45280} format="currency" change={8.3} changeLabel="vs last month" icon={Vault} href="/dashboard/treasury" delay={0} />
          <StatCard label="Monthly Contributions" value={8750} format="currency" change={12.1} changeLabel="vs last month" icon={PiggyBank} href="/dashboard/savings" delay={0.05} />
          <StatCard label="Active Members" value={23} format="number" change={9.5} changeLabel="2 new" icon={Users} href="/dashboard/members" delay={0.1} />
          <StatCard label="Loans Outstanding" value={18500} format="currency" change={-2.4} changeLabel="4 active" icon={Banknote} href="/dashboard/loans" delay={0.15} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Repayment Rate" value={94} format="percent" change={2.1} changeLabel="up 2.1%" icon={TrendingUp} iconColor="text-emerald-500" delay={0.2} />
          <StatCard label="Governance Score" value={87} format="score" icon={Scale} iconColor="text-purple-500" href="/dashboard/governance" delay={0.25} />
          <StatCard label="AI Health Score" value={92} format="score" icon={Sparkles} iconColor="text-[#6393C4]" delay={0.3} />
          <StatCard label="Monthly Growth" value={8} format="percent" change={2.2} changeLabel="from 6.1%" icon={Activity} iconColor="text-teal-500" delay={0.35} />
        </div>

        {/* Charts + Activity */}
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Treasury chart — takes 2 cols */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2 bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-stone-800 dark:text-white">Treasury Growth</h2>
                <p className="text-xs text-stone-400 dark:text-white/40 mt-0.5">12-month cash flow overview</p>
              </div>
              <Link href="/dashboard/treasury" className="text-xs text-[#6393C4] font-semibold flex items-center gap-1 hover:underline">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <AreaChart
              data={CASH_FLOW_HISTORY}
              xKey="month"
              areas={[
                { key: 'balance', label: 'Balance', color: '#6393C4' },
                { key: 'inflow', label: 'Inflow', color: '#10b981' },
              ]}
              height={220}
              formatY={(v) => `$${(v / 1000).toFixed(0)}K`}
            />
          </motion.div>

          {/* Recent activity */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-stone-800 dark:text-white">Recent Activity</h2>
              <Link href="/dashboard/notifications" className="text-xs text-[#6393C4] font-semibold hover:underline">See all</Link>
            </div>
            <div>
              {DEMO_NOTIFICATIONS.slice(0, 6).map((n) => (
                <ActivityItem key={n.id} notif={n} />
              ))}
            </div>
          </motion.div>
        </div>

        {/* Pending actions + AI insights */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Pending loans */}
          {pending > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-[#6393C4]/8 dark:bg-[#6393C4]/10 border border-[#6393C4]/20 dark:border-[#6393C4]/20 rounded-2xl p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-[#6393C4]" />
                <h2 className="text-sm font-semibold text-[#5289B8] dark:text-[#77A6DB]">Pending Review</h2>
                <span className="ml-auto text-xs font-bold text-[#6393C4] dark:text-[#77A6DB] bg-[#6393C4]/15 dark:bg-[#6393C4]/15 px-2 py-0.5 rounded-full">{pending}</span>
              </div>
              <p className="text-xs text-[#5289B8] dark:text-[#77A6DB]/80 mb-4">
                {pending} loan application{pending > 1 ? 's' : ''} {pending > 1 ? 'are' : 'is'} awaiting your review.
              </p>
              <Link
                href="/dashboard/loans"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5289B8] dark:text-[#77A6DB] hover:text-[#6393C4] dark:hover:text-[#77A6DB]"
              >
                Review applications <ArrowRight className="w-3 h-3" />
              </Link>
            </motion.div>
          )}

          {/* AI Insights */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-[#6393C4]" />
              <h2 className="text-sm font-semibold text-stone-800 dark:text-white">Nexa AI Insights</h2>
              <Link href="/dashboard/nexa" className="ml-auto text-xs text-[#6393C4] font-semibold hover:underline">Ask Nexa</Link>
            </div>
            <div className="space-y-3">
              {AI_INSIGHTS.slice(0, 3).map((insight) => (
                <div key={insight.id} className={cn(
                  'flex items-start gap-3 p-3 rounded-xl border text-xs',
                  insight.severity === 'success' && 'bg-emerald-50 dark:bg-emerald-500/6 border-emerald-100 dark:border-emerald-500/15',
                  insight.severity === 'warning' && 'bg-[#6393C4]/8 dark:bg-[#6393C4]/10 border-[#6393C4]/15 dark:border-[#6393C4]/15',
                  insight.severity === 'info' && 'bg-blue-50 dark:bg-blue-500/6 border-blue-100 dark:border-blue-500/15',
                  insight.severity === 'alert' && 'bg-red-50 dark:bg-red-500/6 border-red-100 dark:border-red-500/15',
                )}>
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1',
                    insight.severity === 'success' && 'bg-emerald-400',
                    insight.severity === 'warning' && 'bg-[#77A6DB]',
                    insight.severity === 'info' && 'bg-blue-400',
                    insight.severity === 'alert' && 'bg-red-400',
                  )} />
                  <div>
                    <p className="font-semibold text-stone-700 dark:text-white/85">{insight.title}</p>
                    <p className="text-stone-500 dark:text-white/50 mt-0.5 leading-relaxed">{insight.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}

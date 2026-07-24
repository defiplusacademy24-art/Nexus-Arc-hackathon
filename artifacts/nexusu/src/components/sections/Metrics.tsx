/**
 * Live network metrics for the landing page.
 * Source: GET /api/platform/stats (Postgres when DATABASE_URL is set).
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Bot,
  Users,
  Activity,
  type LucideIcon,
} from 'lucide-react';
import {
  fetchPlatformStats,
  type PlatformStats,
} from '@/services/platform/stats';

const POLL_MS = 30_000;

function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return n.toLocaleString('en-US');
}

type StatCard = {
  key: keyof PlatformStats;
  label: string;
  hint: string;
  icon: LucideIcon;
  accent: string;
  iconBg: string;
};

const CARDS: StatCard[] = [
  {
    key: 'cooperatives',
    label: 'Cooperatives',
    hint: 'Created on the network',
    icon: Building2,
    accent: 'text-[#6393C4]',
    iconBg: 'bg-[#6393C4]/10 border-[#6393C4]/20',
  },
  {
    key: 'agentsRunning',
    label: 'Agents running',
    hint: 'Autonomous agents live',
    icon: Bot,
    accent: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  {
    key: 'members',
    label: 'Members',
    hint: 'Active memberships',
    icon: Users,
    accent: 'text-[#6393C4]',
    iconBg: 'bg-[#6393C4]/10 border-[#6393C4]/20',
  },
  {
    key: 'activeCooperatives',
    label: 'Live workspaces',
    hint: 'Open or active coops',
    icon: Activity,
    accent: 'text-violet-600 dark:text-violet-400',
    iconBg: 'bg-violet-500/10 border-violet-500/20',
  },
];

export function Metrics() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const data = await fetchPlatformStats();
      if (cancelled) return;
      setStats(data);
      setError(false);
      setLoading(false);
    };

    void load().catch(() => {
      if (!cancelled) {
        setError(true);
        setLoading(false);
        setStats({
          cooperatives: 0,
          activeCooperatives: 0,
          members: 0,
          agentsRunning: 0,
          agentsTotal: 0,
          transactions: 0,
        });
      }
    });

    const id = window.setInterval(() => {
      void load();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const values = stats ?? {
    cooperatives: 0,
    activeCooperatives: 0,
    members: 0,
    agentsRunning: 0,
    agentsTotal: 0,
    transactions: 0,
  };

  return (
    <section
      id="network"
      className="relative py-16 sm:py-20 border-y border-stone-200/80 dark:border-[#1A2A3A] bg-white dark:bg-[#06101C]"
      aria-labelledby="network-heading"
    >
      <div
        className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_rgba(99,147,196,0.08),_transparent_55%)]"
        aria-hidden="true"
      />

      <div className="relative container mx-auto px-5 sm:px-6 max-w-6xl">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10 sm:mb-12">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tracking-[0.16em] uppercase">
                Live network
              </p>
            </div>
            <h2
              id="network-heading"
              className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-[#030F1F] dark:text-white leading-tight"
            >
              Platform activity, in real time
            </h2>
            <p className="mt-2 text-sm sm:text-base text-stone-500 dark:text-white/55 leading-relaxed">
              Every cooperative and agent hosted on Nexusu is counted from the live platform store — not demo numbers.
            </p>
          </div>

          <p className="text-xs text-stone-400 dark:text-white/35 font-medium tabular-nums sm:text-right">
            {loading
              ? 'Syncing…'
              : error
                ? 'Showing last known values'
                : stats?.updatedAt
                  ? `Updated ${new Date(stats.updatedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : 'Live'}
            <span className="hidden sm:inline"> · refreshes every 30s</span>
          </p>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {CARDS.map((card, i) => {
            const raw = values[card.key];
            const n = typeof raw === 'number' ? raw : 0;
            const Icon = card.icon;

            return (
              <motion.article
                key={card.key}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
                className="group relative overflow-hidden rounded-2xl border border-stone-200 dark:border-[#1A2A3A] bg-[#F8FAFC] dark:bg-[#0B1624] p-5 sm:p-6 hover:border-[#6393C4]/35 dark:hover:border-[#6393C4]/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center ${card.iconBg}`}
                  >
                    <Icon className={`w-5 h-5 ${card.accent}`} aria-hidden="true" />
                  </div>
                  {card.key === 'agentsRunning' && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                      Live
                    </span>
                  )}
                </div>

                <p
                  className={`text-3xl sm:text-4xl font-display font-bold tabular-nums tracking-tight ${card.accent} ${
                    loading ? 'opacity-40 animate-pulse' : ''
                  }`}
                  aria-live="polite"
                >
                  {formatCount(n)}
                </p>
                <p className="mt-1.5 text-sm font-semibold text-[#030F1F] dark:text-white">
                  {card.label}
                </p>
                <p className="mt-0.5 text-xs text-stone-400 dark:text-white/45 leading-snug">
                  {card.hint}
                </p>
              </motion.article>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-stone-400 dark:text-white/35 max-w-lg mx-auto leading-relaxed">
          Counts start at zero and grow as communities create cooperatives and host autonomous agents on Arc.
        </p>
      </div>
    </section>
  );
}

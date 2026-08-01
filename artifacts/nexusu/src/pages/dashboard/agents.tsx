import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bot,
  RefreshCw,
  Wallet,
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Shield,
  Zap,
  Landmark,
  Users,
  RotateCcw,
  Banknote,
  PiggyBank,
  Scale,
  Sparkles,
  Bell,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import {
  fetchAgentsDashboard,
  fetchAgentsAudit,
  shortAddress,
  type AgentDashboardRow,
  type AgentAuditRow,
} from '@/services/agents/api';
import { cn } from '@/lib/utils';

const ICONS: Record<string, typeof Bot> = {
  treasury: Landmark,
  contribution: Users,
  rotation: RotateCcw,
  loan: Banknote,
  savings: PiggyBank,
  governance: Scale,
  fraud: Shield,
  nexa: Sparkles,
  notification: Bell,
};

const COLORS: Record<string, string> = {
  treasury: 'text-teal-600 bg-teal-50 dark:text-teal-400 dark:bg-teal-500/10',
  contribution: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10',
  rotation: 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-500/10',
  loan: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10',
  savings: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-500/10',
  governance: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10',
  fraud: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10',
  nexa: 'text-[#6393C4] bg-[#6393C4]/10',
  notification: 'text-stone-600 bg-stone-100 dark:text-white/70 dark:bg-white/10',
};

function StatusPill({
  enabled,
  ready,
  walletConfigured,
}: {
  enabled: boolean;
  ready: boolean;
  walletConfigured: boolean;
}) {
  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-stone-50 dark:bg-white/5 text-stone-500 dark:text-white/45 border-stone-200 dark:border-white/10">
        <CircleDashed className="w-3 h-3" />
        Offline
      </span>
    );
  }
  if (ready) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Running
      </span>
    );
  }
  if (!walletConfigured) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20">
        <AlertTriangle className="w-3 h-3" />
        No wallet
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-stone-50 dark:bg-white/5 text-stone-500 border-stone-200 dark:border-white/10">
      Idle
    </span>
  );
}

export default function AgentsPage() {
  const [enabled, setEnabled] = useState(false);
  const [llmConfigured, setLlmConfigured] = useState(false);
  const [llmModel, setLlmModel] = useState('—');
  const [agents, setAgents] = useState<AgentDashboardRow[]>([]);
  const [audit, setAudit] = useState<AgentAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchAgentsDashboard();
    setEnabled(data.enabled);
    setLlmConfigured(data.llmConfigured);
    setLlmModel(data.llmModel);
    setAgents(data.agents);
    if (data.error) setError(data.error);

    if (data.enabled) {
      try {
        const a = await fetchAgentsAudit({ limit: 20 });
        setAudit(a.audit ?? []);
      } catch {
        setAudit([]);
      }
    } else {
      setAudit([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(t);
  }, [load]);

  const walletsReady = agents.filter((a) => a.walletConfigured).length;
  const running = agents.filter((a) => a.ready && enabled).length;

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 py-5 sm:py-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Bot className="w-6 h-6 text-[#6393C4]" />
              AI Agents
            </h1>
            <p className="text-sm text-stone-400 dark:text-white/40 mt-1">
              Autonomous cooperative agents on Arc · Circle Agent Wallets
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-[#6393C4] hover:underline disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Refresh
          </button>
        </div>

        {/* Runtime banner */}
        <div
          className={cn(
            'rounded-2xl border p-4 sm:p-5 mb-6',
            enabled
              ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/80 dark:bg-emerald-500/10'
              : 'border-amber-200 dark:border-amber-500/20 bg-amber-50/80 dark:bg-amber-500/10',
          )}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              {enabled ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-sm font-semibold text-stone-800 dark:text-white">
                  {enabled ? 'Agent runtime is online' : 'Agent runtime is offline'}
                </p>
                <p className="text-xs text-stone-600 dark:text-white/55 mt-0.5 leading-relaxed">
                  {enabled
                    ? `Workers are polling events. Model: ${llmModel || '—'}. Wallets ready: ${walletsReady}/${agents.length}.`
                    : 'Set AGENTS_ENABLED=true on the long-running API worker, DATABASE_URL, CIRCLE_BIN, contract addresses, XAI_API_KEY, and CIRCLE_AGENT_WALLET_*_ADDRESS for each agent. Connecting Circle wallets alone is not enough until the worker is running.'}
                </p>
                {error && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
              <span className="px-2.5 py-1 rounded-full bg-white/80 dark:bg-black/20 border border-stone-200/80 dark:border-white/10">
                Runtime {enabled ? 'on' : 'off'}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/80 dark:bg-black/20 border border-stone-200/80 dark:border-white/10">
                LLM {llmConfigured ? 'ready' : 'missing'}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/80 dark:bg-black/20 border border-stone-200/80 dark:border-white/10">
                {running} running
              </span>
            </div>
          </div>
        </div>

        {/* Agent grid */}
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 mb-8">
          {agents.map((agent, i) => {
            const Icon = ICONS[agent.name] ?? Bot;
            const color = COLORS[agent.name] ?? 'text-[#6393C4] bg-[#6393C4]/10';
            const [textColor, bgColor] = [
              color.split(' ')[0],
              color.split(' ').slice(1).join(' '),
            ];
            return (
              <motion.div
                key={agent.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-4 sm:p-5 flex flex-col"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                        bgColor,
                      )}
                    >
                      <Icon className={cn('w-5 h-5', textColor)} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-stone-900 dark:text-white truncate">
                        {agent.displayName}
                      </p>
                      <p className="text-[11px] text-stone-400 dark:text-white/40 font-mono">
                        {agent.name}
                      </p>
                    </div>
                  </div>
                  <StatusPill
                    enabled={enabled}
                    ready={agent.ready}
                    walletConfigured={agent.walletConfigured}
                  />
                </div>

                <p className="text-xs text-stone-500 dark:text-white/50 leading-relaxed mb-4 flex-1">
                  {agent.blurb}
                </p>

                <div className="space-y-2 text-[11px]">
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 dark:bg-white/5 px-2.5 py-2">
                    <span className="inline-flex items-center gap-1.5 text-stone-400 dark:text-white/40">
                      <Wallet className="w-3.5 h-3.5" />
                      Circle wallet
                    </span>
                    <span
                      className={cn(
                        'font-semibold tabular-nums',
                        agent.walletConfigured
                          ? 'text-stone-800 dark:text-white'
                          : 'text-amber-600 dark:text-amber-400',
                      )}
                      title={agent.walletAddress ?? undefined}
                    >
                      {agent.walletConfigured
                        ? shortAddress(agent.walletAddress)
                        : 'Not set'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 dark:bg-white/5 px-2.5 py-2">
                    <span className="inline-flex items-center gap-1.5 text-stone-400 dark:text-white/40">
                      <Activity className="w-3.5 h-3.5" />
                      Queue
                    </span>
                    <span className="font-semibold text-stone-800 dark:text-white">
                      {agent.queueDepth}
                    </span>
                  </div>
                  {agent.tools.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {agent.tools.slice(0, 4).map((t) => (
                        <span
                          key={t.name}
                          className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#6393C4]/10 text-[#5289B8] dark:text-[#77A6DB] font-medium"
                          title={t.description}
                        >
                          {t.kind}
                        </span>
                      ))}
                      {agent.tools.length > 4 && (
                        <span className="text-[10px] text-stone-400">
                          +{agent.tools.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                  {agent.lastError && (
                    <p className="text-[10px] text-red-600 dark:text-red-400 line-clamp-2">
                      {agent.lastError}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Recent audit */}
        <div className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-[#6393C4]" />
            <h2 className="text-sm font-semibold text-stone-800 dark:text-white">
              Recent decisions
            </h2>
          </div>
          {!enabled ? (
            <p className="text-xs text-stone-400 dark:text-white/40 py-6 text-center">
              Audit log appears when the agent worker is running.
            </p>
          ) : audit.length === 0 ? (
            <p className="text-xs text-stone-400 dark:text-white/40 py-6 text-center">
              No decisions recorded yet. Chain events will enqueue work automatically.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100 dark:divide-white/5">
              {audit.map((row) => (
                <li
                  key={row.id}
                  className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-stone-800 dark:text-white">
                      {agentDisplaySafe(row.agent)} · {row.action}
                    </p>
                    <p className="text-stone-400 dark:text-white/40 mt-0.5">
                      {new Date(row.createdAt).toLocaleString()}
                      {row.txHash ? ` · ${shortAddress(row.txHash)}` : ''}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                      row.status === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                        : row.status === 'blocked'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                          : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
                    )}
                  >
                    {row.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function agentDisplaySafe(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Sparkles, Bot, Zap, ShieldCheck, BarChart3, FileText, Users, TrendingUp, ArrowRight } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { NexaChat } from '@/components/ai/NexaChat';
import {
  fetchAgentsDashboard,
  type AgentDashboardRow,
} from '@/services/agents/api';
import { cn } from '@/lib/utils';

const CAPABILITIES = [
  { icon: BarChart3, title: 'Treasury Analysis', desc: 'Cash flow and forecasts' },
  { icon: Users, title: 'Member Intelligence', desc: 'Compliance and risk scores' },
  { icon: Zap, title: 'Loan Decisions', desc: 'Risk and repayment forecasts' },
  { icon: ShieldCheck, title: 'Fraud Detection', desc: 'Anomaly monitoring' },
  { icon: FileText, title: 'Automated Reports', desc: 'Summaries and audit trails' },
  { icon: TrendingUp, title: 'Governance Insights', desc: 'Proposal and policy analysis' },
];

export default function NexaPage() {
  const [runtimeOn, setRuntimeOn] = useState(false);
  const [agents, setAgents] = useState<AgentDashboardRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchAgentsDashboard().then((data) => {
      if (cancelled) return;
      setRuntimeOn(data.enabled);
      setAgents(data.agents.slice(0, 7));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardLayout>
      {/* Height: top nav 3.5rem + mobile bottom nav ~4.5rem + safe area */}
      <div className="flex h-[calc(100dvh-3.5rem-5.5rem-env(safe-area-inset-bottom))] lg:h-[calc(100dvh-3.5rem)] min-h-0">
        {/* Chat area — takes most space */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-4 border-b border-stone-100 dark:border-[#1A2A3A] bg-white dark:bg-[#081827] flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6393C4] to-[#77A6DB] flex items-center justify-center shadow-sm shadow-[#6393C4]/20 dark:shadow-[#6393C4]/25 flex-shrink-0">
              <Sparkles className="w-4.5 h-4.5 text-white" style={{ width: '1.125rem', height: '1.125rem' }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-stone-900 dark:text-white">Nexa AI</h1>
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    runtimeOn ? 'bg-emerald-400' : 'bg-amber-400',
                  )}
                />
                <span
                  className={cn(
                    'text-[11px] truncate',
                    runtimeOn ? 'text-emerald-500' : 'text-amber-600 dark:text-amber-400',
                  )}
                >
                  {runtimeOn ? 'Runtime online' : 'Assistant only · agents offline'}
                </span>
              </div>
            </div>
          </div>

          <NexaChat />
        </div>

        {/* Right panel — live agents + capabilities */}
        <aside className="hidden xl:flex flex-col w-72 border-l border-stone-100 dark:border-[#1A2A3A] bg-white dark:bg-[#081827] overflow-y-auto flex-shrink-0">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-stone-400 dark:text-white/30 uppercase tracking-widest">
                Agents
              </h2>
              <Link
                href="/dashboard/agents"
                className="text-[10px] font-semibold text-[#6393C4] inline-flex items-center gap-0.5 hover:underline"
              >
                View all
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2 mb-6">
              {agents.length === 0 ? (
                <p className="text-[11px] text-stone-400 dark:text-white/35 py-2">
                  Loading agent status…
                </p>
              ) : (
                agents.map((agent) => (
                  <div
                    key={agent.name}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-stone-50 dark:hover:bg-white/4 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#6393C4]/10">
                      <Bot className="w-3.5 h-3.5 text-[#6393C4]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-stone-700 dark:text-white/80 truncate">
                        {agent.displayName}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full flex-shrink-0',
                            runtimeOn && agent.ready
                              ? 'bg-emerald-400'
                              : agent.walletConfigured
                                ? 'bg-amber-400'
                                : 'bg-stone-300 dark:bg-white/20',
                          )}
                        />
                        <span className="text-[10px] text-stone-400 dark:text-white/40">
                          {!runtimeOn
                            ? 'Offline'
                            : agent.ready
                              ? 'Running'
                              : agent.walletConfigured
                                ? 'Wallet set'
                                : 'No wallet'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <h2 className="text-xs font-semibold text-stone-400 dark:text-white/30 uppercase tracking-widest mb-3">
              Capabilities
            </h2>
            <div className="space-y-2">
              {CAPABILITIES.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="p-3 rounded-xl border border-stone-100 dark:border-[#1A2A3A] hover:border-[#6393C4]/20 dark:hover:border-[#6393C4]/20 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-3.5 h-3.5 text-[#6393C4]" />
                    <p className="text-xs font-semibold text-stone-700 dark:text-white/80">{title}</p>
                  </div>
                  <p className="text-[11px] text-stone-400 dark:text-white/35 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 bg-stone-50 dark:bg-[#2E3B4B]/35 rounded-xl p-3 text-center">
              <p className="text-[10px] text-stone-400 dark:text-white/30">
                AI recommendations are advisory only.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </DashboardLayout>
  );
}

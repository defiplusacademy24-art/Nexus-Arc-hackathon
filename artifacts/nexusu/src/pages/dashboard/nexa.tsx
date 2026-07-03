import { motion } from 'framer-motion';
import { Sparkles, Bot, Zap, ShieldCheck, BarChart3, FileText, Users, TrendingUp } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { NexaChat } from '@/components/ai/NexaChat';
import {
  TreasuryAgent, ContributionAgent, LoanAgent,
  GovernanceAgent, FraudDetectionAgent, NotificationAgent, ReportingAgent,
} from '@/services/ai/nexa';
import { cn } from '@/lib/utils';

const AGENTS = [
  { agent: TreasuryAgent, icon: BarChart3, color: 'text-teal-500 bg-teal-50 dark:bg-teal-500/10' },
  { agent: ContributionAgent, icon: TrendingUp, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
  { agent: LoanAgent, icon: Zap, color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
  { agent: GovernanceAgent, icon: ShieldCheck, color: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10' },
  { agent: FraudDetectionAgent, icon: ShieldCheck, color: 'text-red-500 bg-red-50 dark:bg-red-500/10' },
  { agent: NotificationAgent, icon: Bot, color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
  { agent: ReportingAgent, icon: FileText, color: 'text-[#E8461E] bg-[#E8461E]/5 dark:bg-[#E8461E]/10' },
];

const CAPABILITIES = [
  { icon: BarChart3, title: 'Treasury Analysis', desc: 'Real-time cash flow insights, forecasts, and recommendations' },
  { icon: Users, title: 'Member Intelligence', desc: 'Contribution compliance, risk scoring, and member health' },
  { icon: Zap, title: 'Loan Decisions', desc: 'AI-powered risk assessment and repayment forecasting' },
  { icon: ShieldCheck, title: 'Fraud Detection', desc: 'Continuous monitoring for anomalies and suspicious patterns' },
  { icon: FileText, title: 'Automated Reports', desc: 'Monthly summaries, board reports, and audit trails' },
  { icon: TrendingUp, title: 'Governance Insights', desc: 'Proposal analysis, voting predictions, and policy advice' },
];

export default function NexaPage() {
  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* Chat area — takes most space */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100 dark:border-white/6 bg-white dark:bg-stone-950 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#E8461E] to-[#F97316] flex items-center justify-center shadow-sm shadow-orange-200 dark:shadow-orange-500/20">
              <Sparkles className="w-4.5 h-4.5 text-white" style={{ width: '1.125rem', height: '1.125rem' }} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-stone-900 dark:text-white">Nexa AI</h1>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[11px] text-emerald-500">Online · Monitoring cooperative</span>
              </div>
            </div>
          </div>

          <NexaChat />
        </div>

        {/* Right panel — agents & capabilities */}
        <aside className="hidden xl:flex flex-col w-72 border-l border-stone-100 dark:border-white/6 bg-white dark:bg-stone-950 overflow-y-auto flex-shrink-0">
          <div className="p-5">
            {/* Autonomous Agents */}
            <h2 className="text-xs font-semibold text-stone-400 dark:text-white/30 uppercase tracking-widest mb-3">
              Autonomous Agents
            </h2>
            <div className="space-y-2 mb-6">
              {AGENTS.map(({ agent, icon: Icon, color }) => (
                <div key={agent.name} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-stone-50 dark:hover:bg-white/4 transition-colors">
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', color.split(' ').slice(1).join(' '))}>
                    <Icon className={cn('w-3.5 h-3.5', color.split(' ')[0])} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-stone-700 dark:text-white/80 truncate">{agent.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      <span className="text-[10px] text-emerald-500">Active</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Capabilities */}
            <h2 className="text-xs font-semibold text-stone-400 dark:text-white/30 uppercase tracking-widest mb-3">
              Capabilities
            </h2>
            <div className="space-y-2">
              {CAPABILITIES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="p-3 rounded-xl border border-stone-100 dark:border-white/6 hover:border-[#E8461E]/20 dark:hover:border-[#E8461E]/20 transition-colors group">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-3.5 h-3.5 text-[#E8461E]" />
                    <p className="text-xs font-semibold text-stone-700 dark:text-white/80">{title}</p>
                  </div>
                  <p className="text-[11px] text-stone-400 dark:text-white/35 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-6 bg-stone-50 dark:bg-white/4 rounded-xl p-3 text-center">
              <p className="text-[10px] text-stone-400 dark:text-white/30 leading-relaxed">
                Nexa analyses your cooperative data to provide intelligent recommendations. AI advice is advisory only.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </DashboardLayout>
  );
}

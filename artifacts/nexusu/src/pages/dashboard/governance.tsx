import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Scale, Plus, CheckCircle2, XCircle, Clock, Sparkles, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { useCooperative } from '@/providers/CooperativeProvider';
import { loadProposals } from '@/services/cooperative/proposals';
import { formatDate } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { Proposal, ProposalStatus, ProposalType } from '@/types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const TYPE_BADGE: Record<ProposalType, string> = {
  policy: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
  financial: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
  membership: 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-500/20',
  emergency: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',
};

const STATUS_CONFIG: Record<ProposalStatus, { label: string; icon: React.ElementType; class: string }> = {
  active: { label: 'Active', icon: Clock, class: 'bg-[#6393C4]/8 dark:bg-[#6393C4]/10 text-[#5289B8] dark:text-[#77A6DB] border-[#6393C4]/20 dark:border-[#6393C4]/20' },
  passed: { label: 'Passed', icon: CheckCircle2, class: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' },
  rejected: { label: 'Rejected', icon: XCircle, class: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20' },
  expired: { label: 'Expired', icon: XCircle, class: 'bg-stone-50 dark:bg-[#2E3B4B]/40 text-stone-500 dark:text-white/40 border-stone-200 dark:border-white/10' },
};

function VoteDonut({ votesFor, votesAgainst, abstain }: { votesFor: number; votesAgainst: number; abstain: number }) {
  const data = [
    { name: 'For', value: votesFor || 0, color: '#10b981' },
    { name: 'Against', value: votesAgainst || 0, color: '#ef4444' },
    { name: 'Abstain', value: abstain || 0, color: '#94a3b8' },
  ];
  const total = votesFor + votesAgainst + abstain;
  if (total === 0) {
    return (
      <div className="w-20 h-20 rounded-full border-4 border-stone-100 dark:border-white/10 flex items-center justify-center">
        <span className="text-[10px] text-stone-400">0</span>
      </div>
    );
  }
  return (
    <ResponsiveContainer width={80} height={80}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={24} outerRadius={36} dataKey="value" strokeWidth={0}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const [voted, setVoted] = useState<'for' | 'against' | 'abstain' | null>(null);
  const config = STATUS_CONFIG[proposal.status];
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5 hover:shadow-sm dark:hover:border-white/10 transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-wrap gap-2">
          <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize', TYPE_BADGE[proposal.type])}>
            {proposal.type}
          </span>
          <span className={cn('flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border', config.class)}>
            <Icon className="w-3 h-3" />
            {config.label}
          </span>
        </div>
      </div>

      <h3 className="font-display font-bold text-stone-900 dark:text-white text-sm mb-2">{proposal.title}</h3>
      <p className="text-xs text-stone-500 dark:text-white/50 mb-4 leading-relaxed line-clamp-2">{proposal.description}</p>

      <p className="text-[11px] text-stone-400 dark:text-white/35 mb-4">
        Proposed by <span className="font-semibold text-stone-600 dark:text-white/60">{proposal.proposerName}</span> · {formatDate(proposal.createdAt)}
      </p>

      <div className="flex items-center gap-4 mb-4">
        <VoteDonut votesFor={proposal.votesFor} votesAgainst={proposal.votesAgainst} abstain={proposal.abstain} />
        <div className="flex-1 space-y-2">
          {[
            { label: 'For', count: proposal.votesFor, total: proposal.totalVotes, color: 'bg-emerald-400' },
            { label: 'Against', count: proposal.votesAgainst, total: proposal.totalVotes, color: 'bg-red-400' },
            { label: 'Abstain', count: proposal.abstain, total: proposal.totalVotes, color: 'bg-stone-300 dark:bg-white/20' },
          ].map(({ label, count, total, color }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] text-stone-400 dark:text-white/35 w-10">{label}</span>
              <div className="flex-1 h-1.5 bg-stone-100 dark:bg-white/8 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', color)} style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }} />
              </div>
              <span className="text-[10px] font-semibold text-stone-600 dark:text-white/60 w-4 text-right">{count}</span>
            </div>
          ))}
          <p className="text-[10px] text-stone-400 dark:text-white/35">{proposal.totalVotes}/{proposal.requiredVotes} required</p>
        </div>
      </div>

      {proposal.aiInsight && (
        <div className="bg-[#6393C4]/5 dark:bg-[#6393C4]/8 border border-[#6393C4]/12 rounded-xl px-3 py-2 mb-4">
          <div className="flex items-center gap-1 mb-1">
            <Sparkles className="w-3 h-3 text-[#6393C4]" />
            <span className="text-[10px] font-semibold text-[#6393C4]">Nexa Insight</span>
          </div>
          <p className="text-xs text-stone-600 dark:text-white/60">{proposal.aiInsight}</p>
        </div>
      )}

      {proposal.status === 'active' && (
        <div className="flex gap-2">
          {[
            { key: 'for' as const, label: 'For', icon: ThumbsUp, active: 'bg-emerald-500 text-white', base: 'border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/8' },
            { key: 'against' as const, label: 'Against', icon: ThumbsDown, active: 'bg-red-500 text-white', base: 'border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/8' },
            { key: 'abstain' as const, label: 'Abstain', icon: Minus, active: 'bg-stone-400 text-white', base: 'border-stone-200 dark:border-white/10 text-stone-400 dark:text-white/40 hover:bg-stone-50 dark:hover:bg-[#2E3B4B]/50' },
          ].map(({ key, label, icon: Ic, active, base }) => (
            <button
              key={key}
              type="button"
              onClick={() => setVoted(voted === key ? null : key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all',
                voted === key ? active : base,
              )}
            >
              <Ic className="w-3 h-3" /> {label}
            </button>
          ))}
        </div>
      )}

      {proposal.status === 'active' && proposal.deadline && (
        <p className="text-[10px] text-stone-400 dark:text-white/30 text-center mt-3">
          Voting closes {formatDate(proposal.deadline)}
        </p>
      )}
    </motion.div>
  );
}

export default function Governance() {
  const { activeCooperative } = useCooperative();
  const [filter, setFilter] = useState<'all' | 'active' | 'passed'>('all');
  const [proposals, setProposals] = useState<Proposal[]>([]);

  useEffect(() => {
    setProposals(activeCooperative ? loadProposals(activeCooperative.id) : []);
  }, [activeCooperative?.id]);

  const displayed = filter === 'all'
    ? proposals
    : proposals.filter((p) => (filter === 'active' ? p.status === 'active' : p.status === 'passed'));

  const govScore = activeCooperative?.governanceScore ?? 0;
  const activeCount = proposals.filter((p) => p.status === 'active').length;
  const passedCount = proposals.filter((p) => p.status === 'passed').length;
  // Participation unknown until votes are cast on real proposals
  const participation = proposals.some((p) => p.totalVotes > 0)
    ? Math.round(
        (proposals.reduce((s, p) => s + p.totalVotes, 0) /
          Math.max(1, proposals.reduce((s, p) => s + p.requiredVotes, 0))) *
          100,
      )
    : 0;

  return (
    <DashboardLayout>
      <div className="px-6 py-6 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-4 mb-7">
          <div className="flex-1">
            <h1 className="text-xl font-display font-bold text-stone-900 dark:text-white">Governance</h1>
            <p className="text-sm text-stone-400 dark:text-white/40 mt-0.5">
              {activeCount} active proposal{activeCount === 1 ? '' : 's'}
              {activeCooperative ? ` · Score: ${govScore}/100` : ''}
            </p>
          </div>
          <button type="button" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6393C4] text-white text-sm font-semibold hover:bg-[#5289B8] transition-colors">
            <Plus className="w-4 h-4" /> New Proposal
          </button>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { l: 'Governance Score', v: `${govScore}/100`, c: 'text-purple-500' },
            { l: 'Active Proposals', v: String(activeCount), c: 'text-[#6393C4]' },
            { l: 'Proposals Passed', v: String(passedCount), c: 'text-emerald-500' },
            { l: 'Participation Rate', v: proposals.length === 0 ? '—' : `${participation}%`, c: 'text-blue-500' },
          ].map(({ l, v, c }) => (
            <div key={l} className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-4">
              <p className="text-xs text-stone-400 dark:text-white/40 mb-1">{l}</p>
              <p className={cn('text-xl font-display font-bold', c)}>{v}</p>
            </div>
          ))}
        </motion.div>

        <div className="flex gap-1 mb-6 bg-stone-100 dark:bg-[#2E3B4B]/40 rounded-xl p-1 w-fit">
          {(['all', 'active', 'passed'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize',
                filter === f
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm'
                  : 'text-stone-400 dark:text-white/40',
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {displayed.length === 0 ? (
          <div className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl py-16 text-center px-6">
            <Scale className="w-10 h-10 text-stone-200 dark:text-white/10 mx-auto mb-3" />
            <p className="font-semibold text-stone-700 dark:text-white/70 mb-1">No proposals yet</p>
            <p className="text-sm text-stone-400 dark:text-white/40 max-w-md mx-auto">
              Governance stays empty until your cooperative creates real proposals. Prepared for on-chain voting and AI governance agents.
            </p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {displayed.map((p) => <ProposalCard key={p.id} proposal={p} />)}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

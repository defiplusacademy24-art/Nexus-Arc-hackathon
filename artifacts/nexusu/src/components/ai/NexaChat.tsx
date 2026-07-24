/**
 * Nexa AI chat interface — used both in the full /dashboard/nexa page
 * and the floating sidebar panel.
 * Answers only from live cooperative / treasury context (no mock numbers).
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { getNexaResponse, buildLiveInsights, type NexaContext } from '@/services/ai/nexa';
import { useCooperative } from '@/providers/CooperativeProvider';
import { useWallet } from '@/providers/WalletProvider';
import { loadMembersInPayoutOrder } from '@/services/cooperative/members';
import { loadLoans, outstandingLoansTotal } from '@/services/cooperative/loans';
import { loadProposals } from '@/services/cooperative/proposals';
import { apiListTransactions } from '@/services/notifications/api';
import { sumMonthlyFlows } from '@/services/treasury';
import type { AIMessage, Member } from '@/types';

const QUICK_PROMPTS = [
  'How healthy is our treasury?',
  'Who has missed contributions?',
  'Loan portfolio summary',
  'What should we improve this month?',
];

function MessageBubble({ msg }: { msg: AIMessage }) {
  const isNexa = msg.role === 'nexa';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3', isNexa ? 'items-start' : 'items-start flex-row-reverse')}
    >
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
        isNexa
          ? 'bg-gradient-to-br from-[#6393C4] to-[#77A6DB] shadow-sm'
          : 'bg-stone-200 dark:bg-white/10',
      )}>
        {isNexa ? <Sparkles className="w-3.5 h-3.5 text-white" /> : <User className="w-3.5 h-3.5 text-stone-500 dark:text-white/60" />}
      </div>

      <div className={cn(
        'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
        isNexa
          ? 'bg-white dark:bg-white/6 border border-stone-100 dark:border-[#1A2A3A] text-stone-700 dark:text-white/85'
          : 'bg-[#6393C4] text-white',
      )}>
        {isNexa ? (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:my-1 prose-table:text-xs">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        ) : (
          <p>{msg.content}</p>
        )}
        <p className={cn('text-[10px] mt-2 opacity-50', isNexa ? 'text-right' : 'text-left')}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#6393C4] to-[#77A6DB] flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="bg-white dark:bg-white/6 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            className="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-[#2E3B4B]/350"
          />
        ))}
      </div>
    </div>
  );
}

function welcomeMessage(coopName?: string): AIMessage {
  return {
    id: 'nexa-welcome',
    role: 'nexa',
    content: coopName
      ? `Hello — I'm **Nexa**, your cooperative AI assistant for **${coopName}**.\n\nI only use **live treasury, member, and activity data** (no mock figures). Ask about health, contributions, loans, or governance.`
      : `Hello — I'm **Nexa**, your cooperative AI assistant.\n\nCreate or join a cooperative first. I'll answer only from **real** balances and activity — everything else stays at zero until you have data.`,
    timestamp: new Date().toISOString(),
  };
}

interface NexaChatProps {
  compact?: boolean;
}

export function NexaChat({ compact = false }: NexaChatProps) {
  const { activeCooperative } = useCooperative();
  const { walletAddress } = useWallet();
  const [members, setMembers] = useState<Member[]>([]);
  const [monthlyInflow, setMonthlyInflow] = useState(0);
  const [monthlyOutflow, setMonthlyOutflow] = useState(0);
  const [loanMeta, setLoanMeta] = useState({ count: 0, outstanding: 0 });
  const [proposalMeta, setProposalMeta] = useState({ count: 0, active: 0 });

  const [messages, setMessages] = useState<AIMessage[]>(() => [
    welcomeMessage(activeCooperative?.name),
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages([welcomeMessage(activeCooperative?.name)]);
  }, [activeCooperative?.id, activeCooperative?.name]);

  useEffect(() => {
    if (!activeCooperative) {
      setMembers([]);
      setLoanMeta({ count: 0, outstanding: 0 });
      setProposalMeta({ count: 0, active: 0 });
      return;
    }
    const m = loadMembersInPayoutOrder(activeCooperative.id);
    setMembers(m);
    const loans = loadLoans(activeCooperative.id);
    setLoanMeta({ count: loans.length, outstanding: outstandingLoansTotal(loans) });
    const proposals = loadProposals(activeCooperative.id);
    setProposalMeta({
      count: proposals.length,
      active: proposals.filter((p) => p.status === 'active').length,
    });
  }, [activeCooperative?.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadFlows() {
      if (!walletAddress || !activeCooperative) {
        setMonthlyInflow(0);
        setMonthlyOutflow(0);
        return;
      }
      try {
        const res = await apiListTransactions(walletAddress, {
          coopId: activeCooperative.id,
          limit: 100,
        });
        if (cancelled) return;
        const flows = sumMonthlyFlows(res.transactions ?? []);
        setMonthlyInflow(flows.monthlyInflow);
        setMonthlyOutflow(flows.monthlyOutflow);
      } catch {
        if (!cancelled) {
          setMonthlyInflow(0);
          setMonthlyOutflow(0);
        }
      }
    }
    void loadFlows();
    return () => { cancelled = true; };
  }, [walletAddress, activeCooperative?.id]);

  const nexaCtx: NexaContext = useMemo(
    () => ({
      cooperative: activeCooperative,
      members,
      treasuryBalance: activeCooperative?.treasuryBalance ?? 0,
      monthlyInflow,
      monthlyOutflow,
      loanCount: loanMeta.count,
      loansOutstanding: loanMeta.outstanding,
      proposalCount: proposalMeta.count,
      activeProposalCount: proposalMeta.active,
    }),
    [activeCooperative, members, monthlyInflow, monthlyOutflow, loanMeta, proposalMeta],
  );

  const liveInsights = useMemo(() => buildLiveInsights(nexaCtx), [nexaCtx]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || typing) return;
    const userMsg: AIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    await new Promise((r) => setTimeout(r, 400));

    const response = getNexaResponse(text, nexaCtx);
    const nexaMsg: AIMessage = {
      id: `nexa-${Date.now()}`,
      role: 'nexa',
      content: response,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, nexaMsg]);
    setTyping(false);
  };

  return (
    <div className={cn('flex flex-col h-full min-h-0', compact ? '' : '')}>
      {!compact && liveInsights.length > 0 && (
        <div className="px-4 pt-3 pb-2 flex gap-2 overflow-x-auto flex-shrink-0">
          {liveInsights.slice(0, 3).map((insight) => (
            <div
              key={insight.id}
              className="flex-shrink-0 max-w-[220px] rounded-xl border border-stone-100 dark:border-[#1A2A3A] bg-stone-50 dark:bg-[#2E3B4B]/30 px-3 py-2"
            >
              <p className="text-[10px] font-semibold text-[#6393C4] uppercase tracking-wide">{insight.category}</p>
              <p className="text-xs font-semibold text-stone-700 dark:text-white/80 mt-0.5 line-clamp-2">{insight.title}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
        </AnimatePresence>
        {typing && <TypingIndicator />}
        <div ref={endRef} />
      </div>

      <div className="flex-shrink-0 border-t border-stone-100 dark:border-[#1A2A3A] px-3 py-3 space-y-2">
        <div className="flex gap-1.5 flex-wrap">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => void sendMessage(p)}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-stone-200 dark:border-white/10 text-stone-500 dark:text-white/45 hover:border-[#6393C4]/40 hover:text-[#6393C4] transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
            rows={1}
            placeholder="Ask Nexa anything about your cooperative…"
            className="flex-1 resize-none bg-stone-50 dark:bg-[#2E3B4B]/40 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-white placeholder:text-stone-400 dark:placeholder:text-white/25 outline-none focus:border-[#6393C4]/50 focus:ring-2 focus:ring-[#6393C4]/10"
          />
          <button
            type="button"
            onClick={() => void sendMessage(input)}
            disabled={!input.trim() || typing}
            className="p-2.5 rounded-xl bg-[#6393C4] text-white disabled:opacity-40 hover:bg-[#5289B8] transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-stone-400 dark:text-white/30 text-center">
          Nexa uses your live cooperative data. AI responses are advisory only.
        </p>
      </div>
    </div>
  );
}

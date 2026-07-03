/**
 * Nexa AI chat interface — used both in the full /dashboard/nexa page
 * and the floating sidebar panel.
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { getNexaResponse, AI_INSIGHTS } from '@/services/ai/nexa';
import { INITIAL_AI_MESSAGES } from '@/lib/demo-data';
import type { AIMessage } from '@/types';

const QUICK_PROMPTS = [
  'How healthy is our treasury?',
  'Who has missed contributions?',
  'Should we approve Amina\'s loan?',
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
      {/* Avatar */}
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
        isNexa
          ? 'bg-gradient-to-br from-[#E8461E] to-[#F97316] shadow-sm'
          : 'bg-stone-200 dark:bg-white/10',
      )}>
        {isNexa ? <Sparkles className="w-3.5 h-3.5 text-white" /> : <User className="w-3.5 h-3.5 text-stone-500 dark:text-white/60" />}
      </div>

      {/* Bubble */}
      <div className={cn(
        'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
        isNexa
          ? 'bg-white dark:bg-white/6 border border-stone-100 dark:border-white/8 text-stone-700 dark:text-white/85'
          : 'bg-[#E8461E] text-white',
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
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#E8461E] to-[#F97316] flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="bg-white dark:bg-white/6 border border-stone-100 dark:border-white/8 rounded-2xl px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            className="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-white/40"
          />
        ))}
      </div>
    </div>
  );
}

interface NexaChatProps {
  compact?: boolean;
}

export function NexaChat({ compact = false }: NexaChatProps) {
  const [messages, setMessages] = useState<AIMessage[]>(INITIAL_AI_MESSAGES);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

    // Simulate AI thinking time
    const delay = 800 + Math.random() * 1200;
    await new Promise((r) => setTimeout(r, delay));

    const response = getNexaResponse(text);
    const nexaMsg: AIMessage = {
      id: `nexa-${Date.now()}`,
      role: 'nexa',
      content: response,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, nexaMsg]);
    setTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-full bg-stone-50 dark:bg-[#111110]">
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          {typing && (
            <motion.div key="typing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <TypingIndicator />
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      {/* Quick prompts */}
      {!compact && messages.length <= 1 && (
        <div className="px-4 pb-2">
          <p className="text-[10px] font-semibold text-stone-400 dark:text-white/30 uppercase tracking-widest mb-2">Try asking</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                className="text-left text-xs text-stone-600 dark:text-white/60 bg-white dark:bg-white/5 border border-stone-200 dark:border-white/8 rounded-xl px-3 py-2.5 hover:border-[#E8461E]/40 hover:text-stone-900 dark:hover:text-white transition-all"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-stone-100 dark:border-white/6">
        <div className="flex gap-2 items-end bg-white dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-2xl px-4 py-3 focus-within:border-[#E8461E]/40 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Nexa anything about your cooperative…"
            rows={1}
            className="flex-1 bg-transparent text-sm text-stone-700 dark:text-white placeholder:text-stone-400 dark:placeholder:text-white/30 outline-none resize-none max-h-32"
            style={{ scrollbarWidth: 'none' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || typing}
            className="p-1.5 rounded-xl bg-[#E8461E] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#D03D18] transition-colors flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-stone-300 dark:text-white/20 text-center mt-2">
          Nexa uses your cooperative data. AI responses are advisory only.
        </p>
      </div>
    </div>
  );
}

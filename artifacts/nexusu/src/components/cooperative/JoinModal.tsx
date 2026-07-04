/**
 * JoinModal — Join an existing cooperative via invite code, link, or QR scan.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, QrCode, Link2, Hash, CheckCircle2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCooperative } from '@/providers/CooperativeProvider';
import { useUnicity } from '@/providers/UnicityProvider';
import { normaliseCode } from '@/services/cooperative/invitations';
import type { Cooperative } from '@/types';

type JoinMode = 'code' | 'link';

export function JoinModal({ onClose }: { onClose: () => void }) {
  const { joinCooperative } = useCooperative();
  const { identity } = useUnicity();
  const [mode, setMode] = useState<JoinMode>('code');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState<Cooperative | null>(null);

  const handleJoin = async () => {
    setError('');
    if (!input.trim()) { setError('Please enter an invite code or link.'); return; }

    setLoading(true);
    try {
      let code = input.trim();
      // Extract code from a link like /join/AAA-BBB-CCC
      if (code.includes('/join/')) {
        code = code.split('/join/').pop() ?? code;
      }
      const result = joinCooperative(normaliseCode(code), identity?.walletAddress);
      if (result.ok && result.coop) {
        setJoined(result.coop);
      } else {
        setError(result.error ?? 'Could not join cooperative.');
      }
    } finally {
      setLoading(false);
    }
  };

  const modes: { id: JoinMode; label: string; icon: React.ElementType; placeholder: string }[] = [
    { id: 'code', label: 'Invite Code', icon: Hash, placeholder: 'e.g. ABC-DEF-GH1' },
    { id: 'link', label: 'Invite Link', icon: Link2, placeholder: 'https://nexusu.app/join/…' },
  ];

  if (joined) {
    const initials = joined.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative w-full max-w-sm bg-white dark:bg-stone-950 border border-stone-200 dark:border-white/8 rounded-2xl p-8 text-center shadow-2xl"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#E8461E] to-[#F97316] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/20">
            <span className="text-white font-bold text-xl">{initials}</span>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-3" />
          <h3 className="font-display font-bold text-stone-900 dark:text-white text-lg mb-1">You've joined!</h3>
          <p className="text-stone-500 dark:text-white/50 text-sm mb-1">{joined.name}</p>
          <p className="text-stone-400 dark:text-white/30 text-xs mb-6">{joined.type} · {joined.country}</p>
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#E8461E] text-white text-sm font-semibold hover:bg-[#D03D18] transition-colors"
          >
            Open Workspace <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        className="relative w-full max-w-md bg-white dark:bg-stone-950 border border-stone-200 dark:border-white/8 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-5">
          <div>
            <h2 className="font-display font-bold text-stone-900 dark:text-white">Join a Cooperative</h2>
            <p className="text-xs text-stone-400 dark:text-white/40 mt-0.5">Enter an invite code or paste a link</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-stone-400 dark:text-white/30 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Mode toggle */}
          <div className="flex gap-2 bg-stone-100 dark:bg-white/5 p-1 rounded-xl">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); setInput(''); setError(''); }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all',
                  mode === m.id
                    ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-sm'
                    : 'text-stone-500 dark:text-white/40 hover:text-stone-700 dark:hover:text-white/60',
                )}
              >
                <m.icon className="w-3.5 h-3.5" />
                {m.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="space-y-2">
            <input
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder={modes.find((m) => m.id === mode)?.placeholder}
              autoFocus
              className="w-full bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-stone-800 dark:text-white placeholder:text-stone-400 dark:placeholder:text-white/25 placeholder:font-sans outline-none focus:border-[#E8461E]/50 focus:ring-2 focus:ring-[#E8461E]/10 transition-all"
            />
            {error && <p className="text-xs text-red-500 flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />{error}</p>}
          </div>

          {/* QR placeholder */}
          <div className="border-2 border-dashed border-stone-200 dark:border-white/10 rounded-xl p-5 text-center">
            <QrCode className="w-6 h-6 text-stone-300 dark:text-white/20 mx-auto mb-2" />
            <p className="text-xs text-stone-400 dark:text-white/30 font-semibold">QR Code Scan</p>
            <p className="text-[11px] text-stone-300 dark:text-white/20 mt-0.5">Camera QR scanning coming soon via Sphere Messaging</p>
          </div>

          {/* Info box */}
          <div className="bg-stone-50 dark:bg-white/3 rounded-xl p-4 space-y-1">
            <p className="text-xs font-semibold text-stone-500 dark:text-white/40">How it works</p>
            <ul className="text-[11px] text-stone-400 dark:text-white/30 space-y-0.5 list-disc list-inside">
              <li>Your Unicity wallet identity will be verified before joining</li>
              <li>The cooperative admin will be notified of your membership</li>
              <li>You can leave a cooperative at any time from settings</li>
            </ul>
          </div>

          <button
            onClick={handleJoin}
            disabled={loading || !input.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#E8461E] text-white text-sm font-semibold hover:bg-[#D03D18] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Verifying…' : 'Join Cooperative'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * JoinModal — Member registration + join via invite code or link.
 * Assigns a permanent join-order payout position on success.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Link2, Hash, CheckCircle2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCooperative } from '@/providers/CooperativeProvider';
import { useWallet } from '@/providers/WalletProvider';
import { normaliseCode } from '@/services/cooperative/invitations';
import type { Cooperative, Member } from '@/types';

type JoinMode = 'code' | 'link';

interface JoinSuccess {
  coop: Cooperative;
  joinPosition: number;
  member?: Member;
}

export function JoinModal({ onClose }: { onClose: () => void }) {
  const { joinCooperative } = useCooperative();
  const { identity } = useWallet();
  const [mode, setMode] = useState<JoinMode>('code');
  const [input, setInput] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState<JoinSuccess | null>(null);

  const handleJoin = async () => {
    setError('');
    if (!input.trim()) {
      setError('Please enter an invite code or link.');
      return;
    }
    if (!displayName.trim()) {
      setError('Display name is required.');
      return;
    }
    if (!email.trim()) {
      setError('Email is required to register as a member.');
      return;
    }
    if (!identity?.walletAddress) {
      setError('Connect a wallet before joining a cooperative.');
      return;
    }

    setLoading(true);
    try {
      let code = input.trim();
      if (code.includes('/join/')) {
        code = code.split('/join/').pop() ?? code;
      }
      const result = await joinCooperative(normaliseCode(code), identity.walletAddress, {
        walletAddress: identity.walletAddress,
        displayName: displayName.trim(),
        email: email.trim(),
      });
      if (result.ok && result.coop) {
        // Silent vault membership so joiners can deposit without a separate step
        const { ensureVaultMembership } = await import('@/services/treasury/vault');
        await ensureVaultMembership(identity.walletAddress).catch(() => null);
        setJoined({
          coop: result.coop,
          joinPosition: result.joinPosition ?? result.member?.joinPosition ?? 0,
          member: result.member,
        });
      } else {
        setError(result.error ?? 'Could not join cooperative.');
      }
    } finally {
      setLoading(false);
    }
  };

  const modes: { id: JoinMode; label: string; icon: React.ElementType; placeholder: string }[] = [
    { id: 'code', label: 'Invite Code', icon: Hash, placeholder: 'ABC-DEF-GH1' },
    { id: 'link', label: 'Invite Link', icon: Link2, placeholder: 'https://nexusu.app/join/…' },
  ];

  if (joined) {
    const { coop, joinPosition } = joined;
    const initials = coop.name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative w-full max-w-sm mx-4 sm:mx-0 bg-white dark:bg-[#081827] border border-stone-200 dark:border-[#1A2A3A] rounded-2xl p-6 sm:p-8 text-center shadow-2xl"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6393C4] to-[#77A6DB] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#6393C4]/25">
            <span className="text-white font-bold text-xl">{initials}</span>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-3" />
          <h3 className="font-display font-bold text-stone-900 dark:text-white text-lg mb-1">
            Joined {coop.name}
          </h3>
          <p className="text-stone-400 dark:text-white/30 text-xs mb-5">
            {coop.type} · {coop.country}
          </p>

          <div className="bg-stone-50 dark:bg-[#2E3B4B]/35 rounded-xl p-4 mb-6 text-center">
            <p className="text-xs text-stone-500 dark:text-white/50 mb-1">Payout position</p>
            <p className="text-lg font-display font-bold text-[#6393C4]">
              #{joinPosition || '—'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#6393C4] text-white text-sm font-semibold hover:bg-[#5289B8] transition-colors"
          >
            Open Workspace <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        className="relative w-full sm:max-w-md h-[100dvh] sm:h-auto sm:max-h-[90vh] bg-white dark:bg-[#081827] border-0 sm:border border-stone-200 dark:border-[#1A2A3A] rounded-none sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-5 sm:pt-6 pb-4 sm:pb-5 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="font-display font-bold text-stone-900 dark:text-white">
              Join a Cooperative
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 dark:text-white/30 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 sm:px-6 pb-6 space-y-5 overflow-y-auto flex-1">
          {/* Mode toggle */}
          <div className="flex gap-2 bg-stone-100 dark:bg-[#2E3B4B]/40 p-1 rounded-xl">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMode(m.id);
                  setInput('');
                  setError('');
                }}
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

          {/* Invite input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-stone-500 dark:text-white/50 uppercase tracking-wide">
              {mode === 'code' ? 'Invite Code' : 'Invite Link'}
            </label>
            <input
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder={modes.find((m) => m.id === mode)?.placeholder}
              autoFocus
              className="w-full bg-stone-50 dark:bg-[#2E3B4B]/40 border border-stone-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-stone-800 dark:text-white placeholder:text-stone-400 dark:placeholder:text-white/25 placeholder:font-sans outline-none focus:border-[#6393C4]/50 focus:ring-2 focus:ring-[#6393C4]/10 transition-all"
            />
          </div>

          {/* Registration fields */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-500 dark:text-white/50 uppercase tracking-wide">
                Display Name <span className="text-[#6393C4]">*</span>
              </label>
              <input
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setError('');
                }}
                placeholder="Display name"
                className="w-full bg-stone-50 dark:bg-[#2E3B4B]/40 border border-stone-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-stone-800 dark:text-white placeholder:text-stone-400 dark:placeholder:text-white/25 outline-none focus:border-[#6393C4]/50 focus:ring-2 focus:ring-[#6393C4]/10 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-500 dark:text-white/50 uppercase tracking-wide">
                Email <span className="text-[#6393C4]">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="you@example.com"
                className="w-full bg-stone-50 dark:bg-[#2E3B4B]/40 border border-stone-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-stone-800 dark:text-white placeholder:text-stone-400 dark:placeholder:text-white/25 outline-none focus:border-[#6393C4]/50 focus:ring-2 focus:ring-[#6393C4]/10 transition-all"
              />
            </div>
            {identity?.walletAddress && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-500 dark:text-white/50 uppercase tracking-wide">
                  Wallet
                </label>
                <p className="font-mono text-[11px] text-stone-500 dark:text-white/40 break-all bg-stone-50 dark:bg-[#2E3B4B]/30 rounded-xl px-4 py-2.5">
                  {identity.walletAddress}
                </p>
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />
              {error}
            </p>
          )}

          <button
            onClick={handleJoin}
            disabled={loading || !input.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#6393C4] text-white text-sm font-semibold hover:bg-[#5289B8] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Registering…' : 'Join Cooperative'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

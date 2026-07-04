/**
 * WorkspaceSwitcher — Sidebar dropdown for switching between cooperatives.
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Plus, UserPlus, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCooperative } from '@/providers/CooperativeProvider';
import type { Cooperative } from '@/types';

function CoopAvatar({ coop, size = 'md' }: { coop: Cooperative; size?: 'sm' | 'md' }) {
  const initials = coop.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className={cn(
      'rounded-lg bg-gradient-to-br from-[#E8461E] to-[#F97316] flex items-center justify-center flex-shrink-0',
      size === 'md' ? 'w-8 h-8' : 'w-6 h-6',
    )}>
      <span className={cn('text-white font-bold', size === 'md' ? 'text-xs' : 'text-[10px]')}>{initials}</span>
    </div>
  );
}

interface WorkspaceSwitcherProps {
  onCreateRequest: () => void;
  onJoinRequest: () => void;
}

export function WorkspaceSwitcher({ onCreateRequest, onJoinRequest }: WorkspaceSwitcherProps) {
  const { cooperatives, activeCooperative, setActiveCooperative } = useCooperative();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!activeCooperative) return null;

  const handleSwitch = (id: string) => {
    setActiveCooperative(id);
    setOpen(false);
  };

  const handleCreate = () => { setOpen(false); onCreateRequest(); };
  const handleJoin = () => { setOpen(false); onJoinRequest(); };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-white/6 transition-colors text-left group"
      >
        <CoopAvatar coop={activeCooperative} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-stone-800 dark:text-white truncate">{activeCooperative.name}</p>
          <p className="text-[10px] text-stone-400 dark:text-white/40 truncate">{activeCooperative.type} · {activeCooperative.country}</p>
        </div>
        <ChevronDown className={cn('w-3.5 h-3.5 text-stone-300 dark:text-white/25 group-hover:text-stone-500 dark:group-hover:text-white/40 flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-stone-900 border border-stone-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden"
          >
            {cooperatives.length > 0 && (
              <div className="p-1">
                <p className="px-3 py-1.5 text-[10px] font-semibold text-stone-400 dark:text-white/25 uppercase tracking-widest">Your Cooperatives</p>
                {cooperatives.map((coop) => (
                  <button
                    key={coop.id}
                    onClick={() => handleSwitch(coop.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-white/5 transition-colors text-left"
                  >
                    <CoopAvatar coop={coop} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-stone-800 dark:text-white truncate">{coop.name}</p>
                      <p className="text-[10px] text-stone-400 dark:text-white/35">{coop.memberCount} members</p>
                    </div>
                    {coop.id === activeCooperative.id && (
                      <Check className="w-3.5 h-3.5 text-[#E8461E] flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="border-t border-stone-100 dark:border-white/6 p-1">
              <button
                onClick={handleCreate}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-white/5 transition-colors text-left"
              >
                <div className="w-6 h-6 rounded-md bg-stone-100 dark:bg-white/8 flex items-center justify-center flex-shrink-0">
                  <Plus className="w-3 h-3 text-stone-500 dark:text-white/50" />
                </div>
                <span className="text-xs font-semibold text-stone-600 dark:text-white/60">Create Cooperative</span>
              </button>
              <button
                onClick={handleJoin}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-white/5 transition-colors text-left"
              >
                <div className="w-6 h-6 rounded-md bg-stone-100 dark:bg-white/8 flex items-center justify-center flex-shrink-0">
                  <UserPlus className="w-3 h-3 text-stone-500 dark:text-white/50" />
                </div>
                <span className="text-xs font-semibold text-stone-600 dark:text-white/60">Join with Invite Code</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

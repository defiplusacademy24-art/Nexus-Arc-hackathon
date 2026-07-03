import { motion } from 'framer-motion';
import { ShieldCheck, Building2, Crown } from 'lucide-react';
import { AVATAR_COLORS } from '@/services/unicity/profile';
import type { IdentityDetails } from '@/hooks/useIdentity';
import type { ProfilePrefs } from '@/services/unicity/profile';
import { DEMO_COOPERATIVE } from '@/lib/demo-data';

interface ProfileHeaderProps {
  identity: IdentityDetails;
  prefs: ProfilePrefs;
}

export function ProfileHeader({ identity, prefs }: ProfileHeaderProps) {
  const avatarCfg = AVATAR_COLORS[prefs.avatarColor];
  const displayName =
    prefs.displayNameOverride.trim() || identity.displayName;

  const initials = displayName
    .replace(/^@/, '')
    .split(/[\s._@-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('') || displayName.slice(0, 2).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-white/6 p-6 mb-6"
    >
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#E8461E]/4 via-transparent to-[#F97316]/3 pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {/* Avatar */}
        <div className="relative">
          <div
            className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${avatarCfg.bg} flex items-center justify-center shadow-lg flex-shrink-0`}
          >
            <span className={`text-2xl font-display font-bold ${avatarCfg.text}`}>
              {prefs.avatarEmoji || initials}
            </span>
          </div>
          {/* Verified badge */}
          <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-emerald-500 border-2 border-white dark:border-stone-950 flex items-center justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-white" />
          </div>
        </div>

        {/* Identity info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <h1 className="text-xl font-display font-bold text-stone-900 dark:text-white leading-tight">
              {displayName}
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
              <ShieldCheck className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                Verified by Unicity
              </span>
            </span>
          </div>

          {identity.nametag && (
            <p className="text-sm text-stone-400 dark:text-white/40 font-mono mb-2">
              @{identity.nametag}
            </p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-[#E8461E]" />
              <span className="text-sm text-stone-600 dark:text-white/65 font-medium">
                Founder
              </span>
            </div>
            <span className="text-stone-200 dark:text-white/15">·</span>
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-stone-400 dark:text-white/30" />
              <span className="text-sm text-stone-500 dark:text-white/50">
                {DEMO_COOPERATIVE.name}
              </span>
            </div>
          </div>
        </div>

        {/* Short address chip */}
        <div className="flex-shrink-0 hidden md:block">
          <div className="px-3 py-2 rounded-xl bg-stone-50 dark:bg-white/4 border border-stone-200 dark:border-white/8">
            <p className="text-[9px] font-semibold text-stone-400 dark:text-white/25 uppercase tracking-widest mb-0.5">
              Wallet
            </p>
            <p className="text-xs font-mono text-stone-600 dark:text-white/60">
              {identity.shortAddress}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, ShieldCheck, Globe, Key, Clock, Wifi } from 'lucide-react';
import type { IdentityDetails } from '@/hooks/useIdentity';

function CopyField({
  label,
  value,
  mono = false,
  truncated,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncated?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div className="py-3.5 border-b border-stone-100 dark:border-white/5 last:border-0 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-stone-400 dark:text-white/25 uppercase tracking-widest mb-1">
          {label}
        </p>
        <p
          className={`text-sm text-stone-700 dark:text-white/80 break-all leading-relaxed ${
            mono ? 'font-mono text-xs text-stone-500 dark:text-white/55' : 'font-medium'
          }`}
        >
          {truncated ?? value}
        </p>
      </div>
      <button
        onClick={handleCopy}
        aria-label={`Copy ${label}`}
        className="mt-5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-stone-300 dark:text-white/20 hover:text-[#6393C4] hover:bg-[#6393C4]/8 transition-colors"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

interface IdentityCardProps {
  identity: IdentityDetails;
  delay?: number;
}

export function IdentityCard({ identity, delay = 0 }: IdentityCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl overflow-hidden"
    >
      {/* Card header */}
      <div className="px-5 py-4 border-b border-stone-100 dark:border-[#1A2A3A] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Globe className="w-4 h-4 text-[#6393C4]" />
          <span className="text-sm font-semibold text-stone-800 dark:text-white">
            Wallet Identity
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2.5 py-1 rounded-full">
          <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
            Connected on Arc Testnet
          </span>
        </div>
      </div>

      {/* Fields */}
      <div className="px-5">
        {identity.walletAddress && (
          <CopyField
            label="Wallet Address (DIRECT)"
            value={identity.walletAddress}
            mono
            truncated={identity.shortAddress}
          />
        )}
        {identity.publicKey && (
          <CopyField
            label="Public Key"
            value={identity.publicKey}
            mono
            truncated={`${identity.publicKey.slice(0, 18)}…${identity.publicKey.slice(-10)}`}
          />
        )}
        {identity.nametag && (
          <CopyField label="Sphere Nametag" value={`@${identity.nametag}`} />
        )}
        <CopyField
          label="Network"
          value={identity.network}
        />
      </div>

      {/* Footer stats */}
      <div className="px-5 py-3 bg-stone-50/60 dark:bg-white/2 border-t border-stone-100 dark:border-white/5 grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Wifi className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Live</span>
          </div>
          <p className="text-[9px] text-stone-400 dark:text-white/30 uppercase tracking-wide">Connection</p>
        </div>
        <div className="text-center border-x border-stone-100 dark:border-[#1A2A3A]">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Key className="w-3 h-3 text-[#6393C4]" />
            <span className="text-[10px] font-semibold text-stone-700 dark:text-white/70">Non-custodial</span>
          </div>
          <p className="text-[9px] text-stone-400 dark:text-white/30 uppercase tracking-wide">Key model</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Clock className="w-3 h-3 text-stone-400 dark:text-white/30" />
            <span className="text-[10px] font-semibold text-stone-600 dark:text-white/55">
              {identity.connectionAgeLabel}
            </span>
          </div>
          <p className="text-[9px] text-stone-400 dark:text-white/30 uppercase tracking-wide">Connected</p>
        </div>
      </div>
    </motion.div>
  );
}

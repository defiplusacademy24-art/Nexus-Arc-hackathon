import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Key, Wifi, Monitor, Clock, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import type { SessionInfo } from '@/hooks/useSession';

interface SecurityCardProps {
  session: SessionInfo;
  onDisconnect: () => void;
  onReconnect: () => void;
  delay?: number;
}

export function SecurityCard({ session, onDisconnect, onReconnect, delay = 0 }: SecurityCardProps) {
  const [confirming, setConfirming] = useState(false);

  const securityItems = [
    {
      icon: Key,
      label: 'Key Model',
      value: 'Non-custodial',
      description: 'Only you control your private keys',
      status: 'ok' as const,
    },
    {
      icon: ShieldCheck,
      label: 'Authentication',
      value: session.authMethod,
      description: 'Sphere wallet',
      status: 'ok' as const,
    },
    {
      icon: Wifi,
      label: 'Network',
      value: session.network,
      description: 'Unicity Sphere',
      status: 'ok' as const,
    },
    {
      icon: Monitor,
      label: 'Device',
      value: session.deviceLabel,
      description: 'Current session',
      status: 'ok' as const,
    },
    {
      icon: Clock,
      label: 'Connected',
      value: session.connectedAtLabel,
      description: 'Session start',
      status: 'ok' as const,
    },
    {
      icon: session.isSecure ? ShieldCheck : AlertTriangle,
      label: 'Connection',
      value: session.isSecure ? 'Secure (HTTPS)' : 'Insecure',
      description: session.isSecure ? 'Encrypted transport' : 'HTTP only',
      status: session.isSecure ? 'ok' as const : 'warn' as const,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-white/6 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-stone-100 dark:border-white/6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#E8461E]" />
          <span className="text-sm font-semibold text-stone-800 dark:text-white">Security</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">All clear</span>
        </div>
      </div>

      {/* Security items */}
      <div className="p-5 space-y-2">
        {securityItems.map(({ icon: Icon, label, value, description, status }) => (
          <div
            key={label}
            className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 dark:bg-white/3"
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                status === 'warn'
                  ? 'bg-amber-50 dark:bg-amber-500/10'
                  : 'bg-emerald-50 dark:bg-emerald-500/8'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  status === 'warn' ? 'text-amber-500' : 'text-emerald-500'
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-stone-400 dark:text-white/30">{label}</p>
              <p className="text-sm font-semibold text-stone-700 dark:text-white/80 truncate">{value}</p>
            </div>
            <span className="text-[10px] text-stone-400 dark:text-white/25 hidden sm:block text-right">
              {description}
            </span>
          </div>
        ))}
      </div>

      {/* Warning: never expose keys */}
      <div className="mx-5 mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/8 border border-amber-200 dark:border-amber-500/15 flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
          Private keys and recovery phrases are never accessible through Nexusu. Manage them only in your Sphere wallet.
        </p>
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 flex flex-col gap-2">
        <button
          onClick={() => void onReconnect()}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-stone-200 dark:border-white/10 text-sm font-medium text-stone-600 dark:text-white/60 hover:bg-stone-50 dark:hover:bg-white/5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reconnect Wallet
        </button>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="py-2.5 rounded-xl border border-red-200 dark:border-red-500/20 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/8 transition-colors"
          >
            Disconnect Wallet
          </button>
        ) : (
          <div className="rounded-xl border border-red-300 dark:border-red-500/30 p-3 space-y-2">
            <p className="text-xs text-stone-500 dark:text-white/45 text-center">
              You'll be signed out and returned to the landing page.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 py-2 rounded-lg text-xs font-medium text-stone-500 dark:text-white/40 hover:bg-stone-100 dark:hover:bg-white/6 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void onDisconnect()}
                className="flex-1 py-2 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Confirm Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * ConnectWalletButton — the full "Connect your Unicity Wallet" onboarding screen.
 * Rendered on the /app page when the user is not yet authenticated.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ExternalLink, AlertCircle, Loader2, CheckCircle2, Wallet } from 'lucide-react';
import { WALLET_INSTALL_URL } from '@/services/unicity';

interface ConnectWalletButtonProps {
  onConnect: () => Promise<void>;
  isConnecting: boolean;
  extensionInstalled: boolean;
  error: string | null;
}

function Spinner() {
  return <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />;
}

const trustPoints = [
  { icon: ShieldCheck, text: 'Cryptographic identity — no password ever stored' },
  { icon: CheckCircle2, text: 'Non-custodial — only you control your funds' },
  { icon: Wallet, text: 'One wallet for all Nexusu features' },
];

export function ConnectWalletButton({
  onConnect,
  isConnecting,
  extensionInstalled,
  error,
}: ConnectWalletButtonProps) {
  return (
    <div className="min-h-screen bg-white dark:bg-[#1B1917] flex items-center justify-center p-6">

      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#E8461E]/8 dark:bg-[#E8461E]/12 blur-[160px] rounded-full pointer-events-none" aria-hidden="true" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-white dark:bg-white/10 shadow-md border border-orange-100 dark:border-white/10 flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="Nexusu" className="w-12 h-12 object-contain" />
          </div>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-3xl p-8 shadow-xl dark:shadow-none backdrop-blur-sm">

          <h1 className="text-2xl font-display font-bold text-[#1B1917] dark:text-white text-center mb-2">
            Connect your Unicity Wallet
          </h1>
          <p className="text-stone-500 dark:text-white/55 text-sm text-center leading-relaxed mb-8">
            Your Unicity Wallet serves as your secure decentralised identity for
            accessing Nexusu and managing autonomous community finance.
          </p>

          {/* Trust points */}
          <ul className="space-y-3 mb-8" aria-label="Security features">
            {trustPoints.map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#E8461E]/8 border border-[#E8461E]/15 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                  <Icon className="w-4 h-4 text-[#E8461E]" />
                </div>
                <span className="text-sm text-stone-600 dark:text-white/70">{text}</span>
              </li>
            ))}
          </ul>

          {/* Primary CTA */}
          {extensionInstalled ? (
            /* Extension detected — connect via extension */
            <button
              onClick={() => !isConnecting && onConnect()}
              disabled={isConnecting}
              aria-busy={isConnecting}
              className="w-full bg-[#E8461E] hover:bg-[#D03D18] disabled:opacity-70 disabled:cursor-not-allowed text-white py-4 rounded-2xl text-base font-semibold transition-colors shadow-[0_4px_24px_rgba(232,70,30,0.30)] flex items-center justify-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8461E] focus-visible:ring-offset-2"
            >
              {isConnecting ? (
                <>
                  <Spinner />
                  <span>Connecting securely…</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                  <span>Connect Unicity Wallet</span>
                </>
              )}
            </button>
          ) : (
            /* No extension — show popup option + install prompt */
            <div className="space-y-3">
              <button
                onClick={() => !isConnecting && onConnect()}
                disabled={isConnecting}
                aria-busy={isConnecting}
                className="w-full bg-[#E8461E] hover:bg-[#D03D18] disabled:opacity-70 disabled:cursor-not-allowed text-white py-4 rounded-2xl text-base font-semibold transition-colors shadow-[0_4px_24px_rgba(232,70,30,0.30)] flex items-center justify-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8461E] focus-visible:ring-offset-2"
              >
                {isConnecting ? (
                  <>
                    <Spinner />
                    <span>Opening Sphere Wallet…</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                    <span>Connect Unicity Wallet</span>
                  </>
                )}
              </button>

              <div className="border-t border-stone-100 dark:border-white/8 pt-3">
                <p className="text-xs text-stone-400 dark:text-white/40 text-center mb-3">
                  For the best experience, install the browser extension
                </p>
                <a
                  href={WALLET_INSTALL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-stone-200 dark:border-white/15 text-sm font-medium text-stone-600 dark:text-white/70 hover:bg-stone-50 dark:hover:bg-white/5 hover:border-stone-300 dark:hover:border-white/25 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8461E]"
                >
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                  Install Unicity Wallet
                </a>
              </div>
            </div>
          )}

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="mt-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 flex items-start gap-3"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm text-red-600 dark:text-red-400 leading-relaxed">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Connecting state hint */}
          <AnimatePresence>
            {isConnecting && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-4 text-xs text-stone-400 dark:text-white/40 text-center"
              >
                Approve the connection in your Sphere wallet to continue
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-stone-400 dark:text-white/30 mt-6">
          No email, password, or recovery phrase required.{' '}
          <br />
          Authentication relies entirely on cryptographic wallet verification.
        </p>
      </motion.div>
    </div>
  );
}

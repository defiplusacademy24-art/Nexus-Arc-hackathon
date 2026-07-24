/**
 * /app — Entry after "Launch App".
 * Circle email login modal; shell follows app light/dark theme.
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import { useWallet } from '@/providers/WalletProvider';

export default function AppPage() {
  const wallet = useWallet();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!wallet.isConnected) return;
    // Give Circle's OTP/PIN UI a tick to unmount cleanly before routing.
    const t = window.setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 50);
    return () => window.clearTimeout(t);
  }, [wallet.isConnected, navigate]);

  if (wallet.isAutoConnecting || wallet.isConnected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#030F1F]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2
            className="h-5 w-5 animate-spin text-stone-400 dark:text-white/40"
            aria-hidden="true"
          />
          <span className="text-sm text-stone-400 dark:text-white/40">
            {wallet.isConnected ? 'Opening your dashboard…' : 'Checking session…'}
          </span>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      {/* Theme-aware shell behind the modal */}
      <div
        className="min-h-screen bg-stone-100 dark:bg-[#030F1F]"
        aria-hidden="true"
      />
      <ConnectWalletButton />
    </>
  );
}

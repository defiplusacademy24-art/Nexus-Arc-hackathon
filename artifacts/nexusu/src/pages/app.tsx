/**
 * /app — Entry point after clicking "Launch App".
 * Shows the Connect Wallet screen when unauthenticated,
 * auto-redirects to /onboarding when the wallet is connected.
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import { useUnicity } from '@/providers/UnicityProvider';

export default function AppPage() {
  const wallet = useUnicity();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (wallet.isConnected) {
      navigate('/dashboard', { replace: true });
    }
  }, [wallet.isConnected, navigate]);

  // Blank screen during silent auto-connect — avoids flash of Connect button
  if (wallet.isAutoConnecting) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#1B1917] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-14 h-14 rounded-2xl bg-white dark:bg-white/10 shadow-md border border-orange-100 dark:border-white/10 flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="Nexusu" className="w-10 h-10 object-contain" />
          </div>
          <div className="flex items-center gap-2 text-stone-400 dark:text-white/40 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span>Checking wallet connection…</span>
          </div>
        </motion.div>
      </div>
    );
  }

  if (wallet.isConnected) {
    return null; // redirect in flight
  }

  return (
    <ConnectWalletButton
      onConnect={wallet.connect}
      isConnecting={wallet.isConnecting}
      extensionInstalled={wallet.extensionInstalled}
      error={wallet.error}
    />
  );
}

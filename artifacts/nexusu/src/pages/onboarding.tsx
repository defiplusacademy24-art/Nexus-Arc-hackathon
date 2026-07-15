/**
 * /onboarding — Post-authentication dashboard.
 * Shows the verified wallet identity and guides the user into Nexusu.
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Copy,
  LogOut,
  ArrowRight,
  Users,
  Wallet,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { useWallet } from '@/providers/WalletProvider';
import { truncateAddress } from '@/services/wallet';
import { useToast } from '@/hooks/use-toast';

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-stone-50 dark:bg-[#2E3B4B]/40 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl px-5 py-4 text-center">
      <div className="text-xl font-display font-bold text-[#6393C4]">{value}</div>
      <div className="text-xs text-stone-400 dark:text-white/40 font-mono uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}

const nextSteps = [
  {
    icon: Users,
    title: 'Create a Cooperative',
    desc: 'Set up your savings group in minutes.',
    cta: 'Coming soon',
    disabled: true,
  },
  {
    icon: Wallet,
    title: 'Fund your Wallet',
    desc: 'Add funds to start participating.',
    cta: 'Coming soon',
    disabled: true,
  },
  {
    icon: Activity,
    title: 'View Dashboard',
    desc: 'Track your cooperative activity.',
    cta: 'Coming soon',
    disabled: true,
  },
];

export default function Onboarding() {
  const wallet = useWallet();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!wallet.isConnected && !wallet.isAutoConnecting) {
      navigate('/app', { replace: true });
    }
  }, [wallet.isConnected, wallet.isAutoConnecting, navigate]);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: `${label} copied`,
        description: 'Copied to clipboard.',
        duration: 2000,
      });
    } catch {
      toast({ title: 'Copy failed', description: 'Please copy manually.', variant: 'destructive' });
    }
  };

  const handleDisconnect = async () => {
    await wallet.disconnect();
    navigate('/', { replace: true });
  };

  if (!wallet.identity) return null;

  const { identity } = wallet;

  return (
    <div className="min-h-screen bg-[#EEF2F6] dark:bg-[#030F1F] relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#6393C4]/6 blur-[150px] rounded-full pointer-events-none" aria-hidden="true" />

      {/* Top bar */}
      <header className="border-b border-[#1A2A3A]/15 dark:border-[#1A2A3A] bg-white/80 dark:bg-[#030F1F]/80 backdrop-blur-md">
        <div className="container mx-auto px-6 max-w-5xl h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5" aria-label="Nexusu home">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white flex-shrink-0 shadow-sm border border-[#1A2A3A]/15 dark:border-white/10">
              <img src="/logo.png" alt="" className="w-full h-full object-contain" aria-hidden="true" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-[#030F1F] dark:text-white">Nexusu</span>
          </a>

          <div className="flex items-center gap-3">
            {/* Connection badge */}
            <div className="hidden sm:flex items-center gap-2 bg-green-50 dark:bg-green-400/10 border border-green-200 dark:border-green-400/20 text-green-700 dark:text-green-400 text-xs font-semibold px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
              Verified
            </div>

            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 text-sm text-stone-400 dark:text-white/40 hover:text-stone-700 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6393C4] rounded"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Disconnect</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 max-w-5xl py-12">

        {/* Welcome hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <CheckCircle2 className="w-5 h-5 text-green-500" aria-hidden="true" />
            <span className="text-sm font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">
              Wallet Connected &amp; Verified
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-[#030F1F] dark:text-white mb-3">
            Welcome to Nexusu,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6393C4] to-[#77A6DB]">
              {identity.displayName}
            </span>
          </h1>
          <p className="text-stone-500 dark:text-white/55 text-base max-w-xl leading-relaxed">
            Your decentralised identity is verified. You're ready to create and manage autonomous community finance.
          </p>
        </motion.div>

        {/* Identity card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white dark:bg-[#2E3B4B]/40 border border-stone-200 dark:border-white/10 rounded-3xl p-7 mb-6 shadow-sm dark:shadow-none"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#6393C4]/8 border border-[#6393C4]/15 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[#6393C4]" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-[#030F1F] dark:text-white text-sm">Verified Identity</h2>
              <p className="text-xs text-stone-400 dark:text-white/40">Connected on Arc Testnet</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Wallet address */}
            <div>
              <label className="block text-xs font-mono font-semibold text-stone-400 dark:text-white/40 uppercase tracking-widest mb-1.5">
                Secure Identity
              </label>
              <div className="flex items-center gap-3 bg-stone-50 dark:bg-[#2E3B4B]/40 border border-stone-100 dark:border-[#1A2A3A] rounded-xl px-4 py-3">
                <span className="font-mono text-sm text-[#030F1F] dark:text-white/90 break-all flex-1 min-w-0">
                  {identity.walletAddress || 'Not available'}
                </span>
                {identity.walletAddress && (
                  <button
                    onClick={() => handleCopy(identity.walletAddress, 'Address')}
                    aria-label="Copy wallet address"
                    className="flex-shrink-0 text-stone-400 dark:text-white/40 hover:text-[#6393C4] dark:hover:text-[#6393C4] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6393C4] rounded"
                  >
                    <Copy className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>



            {/* Nametag */}
            {identity.nametag && (
              <div>
                <label className="block text-xs font-mono font-semibold text-stone-400 dark:text-white/40 uppercase tracking-widest mb-1.5">
                  Nametag
                </label>
                <div className="bg-stone-50 dark:bg-[#2E3B4B]/40 border border-stone-100 dark:border-[#1A2A3A] rounded-xl px-4 py-3">
                  <span className="font-mono text-sm text-[#77A6DB] font-semibold">@{identity.nametag}</span>
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            <StatBadge label="Status" value="Active" />
            <StatBadge label="Network" value="Testnet" />
            <StatBadge label="Auth" value="Verified" />
          </div>
        </motion.div>

        {/* Next steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="font-display font-bold text-lg text-[#030F1F] dark:text-white mb-4">
            What would you like to do?
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {nextSteps.map((step, i) => (
              <div
                key={i}
                className={`bg-white dark:bg-[#2E3B4B]/40 border rounded-2xl p-6 transition-all ${
                  step.disabled
                    ? 'border-stone-100 dark:border-[#1A2A3A] opacity-60 cursor-not-allowed'
                    : 'border-stone-200 dark:border-white/10 hover:border-[#6393C4]/30 hover:shadow-sm cursor-pointer'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#6393C4]/8 border border-[#6393C4]/15 flex items-center justify-center mb-4">
                  <step.icon className="w-5 h-5 text-[#6393C4]" aria-hidden="true" />
                </div>
                <h3 className="font-display font-semibold text-[#030F1F] dark:text-white text-sm mb-1">{step.title}</h3>
                <p className="text-xs text-stone-400 dark:text-white/50 leading-relaxed mb-4">{step.desc}</p>
                <div className="flex items-center gap-1 text-xs text-[#6393C4] font-semibold">
                  {step.cta}
                  {!step.disabled && <ArrowRight className="w-3 h-3" aria-hidden="true" />}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}

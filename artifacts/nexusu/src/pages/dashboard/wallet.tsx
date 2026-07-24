import { motion } from 'framer-motion';
import { ShieldCheck, Copy, ExternalLink, Wallet, CheckCircle2, Globe } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { useWallet } from '@/providers/WalletProvider';
import { ARC_EXPLORER_URL, ARC_TESTNET_CHAIN_ID } from '@/config/arc';
import { ARC_FAUCET_URL, ARC_NETWORK_LABEL } from '@/services/wallet/constants';
import { useToast } from '@/hooks/use-toast';

function InfoRow({ label, value, mono = false, onCopy }: {
  label: string; value: string; mono?: boolean; onCopy?: () => void;
}) {
  return (
    <div className="py-4 border-b border-stone-50 dark:border-white/4 last:border-0">
      <p className="text-xs font-semibold text-stone-400 dark:text-white/30 uppercase tracking-widest mb-2">{label}</p>
      <div className="flex items-center gap-3">
        <p className={`flex-1 text-sm text-stone-700 dark:text-white/80 break-all leading-relaxed ${mono ? 'font-mono text-xs' : 'font-medium'}`}>
          {value}
        </p>
        {onCopy && (
          <button
            onClick={onCopy}
            className="flex-shrink-0 p-1.5 rounded-lg text-stone-400 dark:text-white/30 hover:text-[#6393C4] hover:bg-[#6393C4]/8 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function WalletProfile() {
  const { identity, walletAddress, disconnect, chainId, isOnArcTestnet } = useWallet();
  const { toast } = useToast();

  const copy = async (text: string, label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied`, duration: 2000 });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  if (!identity) return null;

  const explorerLink = walletAddress
    ? `${ARC_EXPLORER_URL}/address/${walletAddress}`
    : ARC_EXPLORER_URL;

  return (
    <DashboardLayout>
      <div className="px-6 py-6 max-w-2xl mx-auto">

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
          <h1 className="text-xl font-display font-bold text-stone-900 dark:text-white">Wallet Profile</h1>
          <p className="text-sm text-stone-400 dark:text-white/40 mt-0.5">Your Circle email wallet on Arc Testnet</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-gradient-to-br from-[#6393C4] to-[#77A6DB] rounded-2xl p-7 mb-5 text-white relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 30%, white, transparent 60%)' }} />

          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold">{identity.displayName}</h2>
              <p className="text-white/70 text-sm">{ARC_NETWORK_LABEL}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2">
            <CheckCircle2 className="w-4 h-4 text-white flex-shrink-0" />
            <span className="text-sm font-semibold">
              {isOnArcTestnet ? 'Signed in · Arc Testnet' : 'Session not on Arc Testnet'}
            </span>
            <span className="ml-auto text-xs text-white/70">USDC gas</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5 mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-[#6393C4]" />
            <h2 className="text-sm font-semibold text-stone-800 dark:text-white">Wallet Details</h2>
          </div>

          {walletAddress && (
            <InfoRow
              label="Wallet Address"
              value={walletAddress}
              mono
              onCopy={() => copy(walletAddress, 'Wallet address')}
            />
          )}
          <InfoRow label="Network" value={ARC_NETWORK_LABEL} />
          <InfoRow label="Chain ID" value={String(chainId ?? ARC_TESTNET_CHAIN_ID)} mono />
          <InfoRow
            label="Gas Token"
            value="USDC (native on Arc)"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5 mb-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-[#6393C4]" />
            <h2 className="text-sm font-semibold text-stone-800 dark:text-white">Security Model</h2>
          </div>
          <div className="space-y-3">
            {[
              { text: 'Non-custodial — only you control your private keys' },
              { text: 'EVM-compatible wallet on Circle Arc Testnet' },
              { text: 'USDC used for gas and treasury operations' },
              { text: 'Connection persists via wagmi session in this browser' },
            ].map(({ text }) => (
              <div key={text} className="flex items-center gap-3 text-sm">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <span className="text-stone-600 dark:text-white/65">{text}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col gap-3"
        >
          <a
            href={explorerLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-3 rounded-xl border border-stone-200 dark:border-white/10 text-sm font-medium text-stone-600 dark:text-white/60 hover:bg-stone-50 dark:hover:bg-[#2E3B4B]/50 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            View on ArcScan
          </a>
          <a
            href={ARC_FAUCET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-3 rounded-xl border border-[#6393C4]/25 text-sm font-medium text-[#6393C4] hover:bg-[#6393C4]/8 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            Get Testnet USDC
          </a>
          <button
            onClick={async () => { await disconnect(); window.location.href = '/'; }}
            className="py-3 rounded-xl border border-red-200 dark:border-red-500/20 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/8 transition-colors"
          >
            Sign out
          </button>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
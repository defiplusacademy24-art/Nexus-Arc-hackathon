import { motion } from 'framer-motion';
import { ShieldCheck, Copy, ExternalLink, Wallet, CheckCircle2, Key, Globe, Clock } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { useUnicity } from '@/providers/UnicityProvider';
import { truncateWallet } from '@/utils/format';
import { WALLET_INSTALL_URL } from '@/services/unicity';
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
            className="flex-shrink-0 p-1.5 rounded-lg text-stone-400 dark:text-white/30 hover:text-[#E8461E] hover:bg-[#E8461E]/8 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function WalletProfile() {
  const { identity, walletAddress, publicKey, session, disconnect } = useUnicity();
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

  return (
    <DashboardLayout>
      <div className="px-6 py-6 max-w-2xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
          <h1 className="text-xl font-display font-bold text-stone-900 dark:text-white">Wallet Profile</h1>
          <p className="text-sm text-stone-400 dark:text-white/40 mt-0.5">Your Unicity decentralised identity</p>
        </motion.div>

        {/* Identity card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-gradient-to-br from-[#E8461E] to-[#F97316] rounded-2xl p-7 mb-5 text-white relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 30%, white, transparent 60%)' }} />

          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold">{identity.displayName}</h2>
              {identity.nametag && (
                <p className="text-white/70 text-sm">@{identity.nametag}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2">
            <CheckCircle2 className="w-4 h-4 text-white flex-shrink-0" />
            <span className="text-sm font-semibold">Verified by Unicity Network</span>
            <span className="ml-auto text-xs text-white/70">testnet2</span>
          </div>
        </motion.div>

        {/* Details */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-white/6 rounded-2xl p-5 mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-[#E8461E]" />
            <h2 className="text-sm font-semibold text-stone-800 dark:text-white">Identity Details</h2>
          </div>

          {walletAddress && (
            <InfoRow
              label="Wallet Address (DIRECT)"
              value={walletAddress}
              mono
              onCopy={() => copy(walletAddress, 'Wallet address')}
            />
          )}
          {publicKey && (
            <InfoRow
              label="Public Key"
              value={publicKey}
              mono
              onCopy={() => copy(publicKey, 'Public key')}
            />
          )}
          {identity.nametag && (
            <InfoRow label="Registered Nametag" value={`@${identity.nametag}`} />
          )}
          <InfoRow label="Verification Status" value="Verified · Unicity Sphere" />
          {session && (
            <InfoRow label="Session ID" value={truncateWallet(session, 12, 8)} mono />
          )}
        </motion.div>

        {/* Security */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-white/6 rounded-2xl p-5 mb-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-[#E8461E]" />
            <h2 className="text-sm font-semibold text-stone-800 dark:text-white">Security Model</h2>
          </div>
          <div className="space-y-3">
            {[
              { icon: Key, text: 'Non-custodial — only you control your private keys' },
              { icon: ShieldCheck, text: 'Cryptographic identity — no username/password stored' },
              { icon: CheckCircle2, text: 'Verified on Unicity Network (testnet2)' },
              { icon: Globe, text: 'Session persists in this browser tab only' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <span className="text-stone-600 dark:text-white/65">{text}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col gap-3"
        >
          <a
            href={WALLET_INSTALL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-3 rounded-xl border border-stone-200 dark:border-white/10 text-sm font-medium text-stone-600 dark:text-white/60 hover:bg-stone-50 dark:hover:bg-white/5 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            Open Sphere Wallet
          </a>
          <button
            onClick={async () => { await disconnect(); window.location.href = '/'; }}
            className="py-3 rounded-xl border border-red-200 dark:border-red-500/20 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/8 transition-colors"
          >
            Disconnect Wallet
          </button>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

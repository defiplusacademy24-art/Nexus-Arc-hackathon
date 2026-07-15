/**
 * ConnectWalletButton — Arc Testnet wallet onboarding screen.
 * Supports wallet picker, WalletConnect (mobile), and browser extensions.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  ExternalLink,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Wallet,
  Smartphone,
} from 'lucide-react';
import { WalletPickerModal } from '@/components/WalletPickerModal';
import { useWallet } from '@/providers/WalletProvider';
import { WALLET_INSTALL_URL, ARC_FAUCET_URL, ARC_NETWORK_LABEL } from '@/services/wallet/constants';

function Spinner() {
  return <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />;
}

const trustPoints = [
  { icon: ShieldCheck, text: 'Non-custodial — you control your keys' },
  { icon: CheckCircle2, text: `Built on ${ARC_NETWORK_LABEL} with USDC gas` },
  { icon: Wallet, text: 'One wallet for all Nexusu features' },
];

export function ConnectWalletButton() {
  const wallet = useWallet();
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleChooseWallet = async () => {
    if (wallet.isConnecting) return;

    if (wallet.walletConnectEnabled) {
      await wallet.connect();
      return;
    }

    if (wallet.isWalletInAppBrowser) {
      await wallet.connectViaExtension();
      return;
    }

    setPickerOpen(true);
  };

  const handleOpenWalletConnect = async () => {
    setPickerOpen(false);
    await wallet.connect();
  };

  const handleSelectWallet = async (selected: Parameters<typeof wallet.connectWithWallet>[0]) => {
    await wallet.connectWithWallet(selected);
    setPickerOpen(false);
  };

  return (
    <>
      <div className="min-h-screen bg-white dark:bg-[#030F1F] flex items-center justify-center p-6">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#6393C4]/8 dark:bg-[#6393C4]/12 blur-[160px] rounded-full pointer-events-none"
          aria-hidden="true"
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-white/10 shadow-md border border-[#1A2A3A]/15 dark:border-white/10 flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="Nexusu" className="w-12 h-12 object-contain" />
            </div>
          </div>

          <div className="bg-white dark:bg-[#2E3B4B]/40 border border-stone-200 dark:border-white/10 rounded-3xl p-8 shadow-xl dark:shadow-none backdrop-blur-sm">
            <h1 className="text-2xl font-display font-bold text-[#030F1F] dark:text-white text-center mb-2">
              Connect your Wallet on Arc
            </h1>
            <p className="text-stone-500 dark:text-white/55 text-sm text-center leading-relaxed mb-8">
              Choose any EVM wallet — MetaMask, Rainbow, Trust, Coinbase, and more.
              Works from mobile Chrome or Safari via WalletConnect.
            </p>

            <ul className="space-y-3 mb-8" aria-label="Security features">
              {trustPoints.map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#6393C4]/8 border border-[#6393C4]/15 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                    <Icon className="w-4 h-4 text-[#6393C4]" />
                  </div>
                  <span className="text-sm text-stone-600 dark:text-white/70">{text}</span>
                </li>
              ))}
            </ul>

            {wallet.isMobileBrowser && !wallet.isWalletInAppBrowser && (
              <div className="mb-4 flex items-start gap-2.5 p-3 rounded-2xl bg-[#6393C4]/8 border border-[#6393C4]/15">
                <Smartphone className="w-4 h-4 text-[#6393C4] flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs text-stone-600 dark:text-white/65 leading-relaxed">
                  On mobile, pick your wallet and approve in the app — you stay in your browser.
                </p>
              </div>
            )}

            <button
              onClick={() => void handleChooseWallet()}
              disabled={wallet.isConnecting}
              aria-busy={wallet.isConnecting}
              className="w-full bg-[#6393C4] hover:bg-[#5289B8] disabled:opacity-70 disabled:cursor-not-allowed text-white py-4 rounded-2xl text-base font-semibold transition-colors shadow-[0_4px_24px_rgba(99,147,196,0.30)] flex items-center justify-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6393C4] focus-visible:ring-offset-2"
            >
              {wallet.isConnecting ? (
                <>
                  <Spinner />
                  <span>Connecting to Arc…</span>
                </>
              ) : (
                <>
                  <Wallet className="w-5 h-5" aria-hidden="true" />
                  <span>Choose Wallet</span>
                </>
              )}
            </button>

            <div className="border-t border-stone-100 dark:border-[#1A2A3A] pt-3 mt-3 space-y-2">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                disabled={wallet.isConnecting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-stone-200 dark:border-white/15 text-sm font-medium text-stone-600 dark:text-white/70 hover:bg-stone-50 dark:hover:bg-[#2E3B4B]/50 hover:border-stone-300 dark:hover:border-white/25 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6393C4] disabled:opacity-60"
              >
                Browse all wallet options
              </button>

              {!wallet.extensionInstalled && !wallet.isMobileBrowser && (
                <a
                  href={WALLET_INSTALL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-stone-200 dark:border-white/15 text-sm font-medium text-stone-600 dark:text-white/70 hover:bg-stone-50 dark:hover:bg-[#2E3B4B]/50 hover:border-stone-300 dark:hover:border-white/25 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6393C4]"
                >
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                  Install MetaMask
                </a>
              )}

              <a
                href={ARC_FAUCET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-medium text-[#6393C4] hover:text-[#5289B8] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                Get testnet USDC from Circle Faucet
              </a>
            </div>

            <AnimatePresence>
              {wallet.error && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  className="mt-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 flex items-start gap-3"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-sm text-red-600 dark:text-red-400 leading-relaxed">{wallet.error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {wallet.isConnecting && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 text-xs text-stone-400 dark:text-white/40 text-center"
                >
                  Approve the connection in your wallet app, then return to this tab
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <p className="text-center text-xs text-stone-400 dark:text-white/30 mt-6">
            Powered by Circle&apos;s Arc network · Chain ID 5042002
          </p>
        </motion.div>
      </div>

      <WalletPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelectWallet={handleSelectWallet}
        onOpenWalletConnect={wallet.walletConnectEnabled ? handleOpenWalletConnect : undefined}
        isConnecting={wallet.isConnecting}
        error={wallet.error}
      />
    </>
  );
}
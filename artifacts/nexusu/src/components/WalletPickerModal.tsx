import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Loader2, Smartphone, Monitor } from 'lucide-react';
import { isMobileBrowser } from '@/lib/device';
import { discoverInjectedWallets, type DiscoveredWallet } from '@/lib/wallet-discovery';
import { getDappUrl, MOBILE_WALLET_OPTIONS } from '@/lib/mobile-wallet-links';
import { hasWalletConnectProjectId } from '@/config/wagmi';

interface WalletPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelectWallet: (wallet: DiscoveredWallet) => Promise<void>;
  onOpenWalletConnect?: () => Promise<void>;
  isConnecting: boolean;
  error: string | null;
}

export function WalletPickerModal({
  open,
  onClose,
  onSelectWallet,
  onOpenWalletConnect,
  isConnecting,
  error,
}: WalletPickerModalProps) {
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [loading, setLoading] = useState(false);
  const isMobile = isMobileBrowser();
  const walletConnectReady = hasWalletConnectProjectId();

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);

    void discoverInjectedWallets().then((found) => {
      if (!cancelled) {
        setWallets(found);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const dappUrl = getDappUrl();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-[#0D1B2F] border border-stone-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-picker-title"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 dark:border-white/10">
              <div>
                <h2 id="wallet-picker-title" className="text-lg font-semibold text-[#030F1F] dark:text-white">
                  Choose a wallet
                </h2>
                <p className="text-xs text-stone-500 dark:text-white/50 mt-0.5">
                  {isMobile
                    ? 'Connect from Chrome or Safari — your wallet app will open to approve'
                    : 'Pick a browser extension or connect via WalletConnect'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-stone-400 hover:bg-stone-100 dark:hover:bg-white/10 transition-colors"
                aria-label="Close wallet picker"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {walletConnectReady && onOpenWalletConnect && (
                <section>
                  <p className="text-[11px] uppercase tracking-widest text-stone-400 dark:text-white/40 font-medium mb-2 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5" />
                    All wallets (recommended)
                  </p>
                  <button
                    type="button"
                    disabled={isConnecting}
                    onClick={() => void onOpenWalletConnect()}
                    className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-[#6393C4]/30 bg-[#6393C4]/8 hover:bg-[#6393C4]/15 transition-colors text-left disabled:opacity-60"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#6393C4]/20 flex items-center justify-center text-[#6393C4] font-bold text-sm">
                      WC
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#030F1F] dark:text-white">
                        WalletConnect
                      </p>
                      <p className="text-xs text-stone-500 dark:text-white/50 truncate">
                        MetaMask, Rainbow, Trust, Coinbase & 300+ wallets
                      </p>
                    </div>
                  </button>
                </section>
              )}

              {wallets.length > 0 && (
                <section>
                  <p className="text-[11px] uppercase tracking-widest text-stone-400 dark:text-white/40 font-medium mb-2 flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5" />
                    {isMobile ? 'Wallet in this browser' : 'Browser extensions'}
                  </p>
                  <div className="space-y-2">
                    {wallets.map((wallet) => (
                      <button
                        key={wallet.uuid}
                        type="button"
                        disabled={isConnecting || loading}
                        onClick={() => void onSelectWallet(wallet)}
                        className="w-full flex items-center gap-3 p-3 rounded-2xl border border-stone-200 dark:border-white/10 hover:border-[#6393C4]/40 hover:bg-stone-50 dark:hover:bg-white/5 transition-colors text-left disabled:opacity-60"
                      >
                        {wallet.icon ? (
                          <img
                            src={wallet.icon}
                            alt=""
                            className="w-10 h-10 rounded-xl"
                            width={40}
                            height={40}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-stone-500">
                            {wallet.name.slice(0, 2)}
                          </div>
                        )}
                        <span className="text-sm font-medium text-[#030F1F] dark:text-white">
                          {wallet.name}
                        </span>
                        {isConnecting && <Loader2 className="w-4 h-4 ml-auto animate-spin text-[#6393C4]" />}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {loading && wallets.length === 0 && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-stone-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching for wallets…
                </div>
              )}

              {isMobile && (
                <section>
                  <p className="text-[11px] uppercase tracking-widest text-stone-400 dark:text-white/40 font-medium mb-2">
                    Open in wallet app
                  </p>
                  <p className="text-xs text-stone-500 dark:text-white/50 mb-2">
                    No extension detected? Open Nexusu inside your wallet&apos;s browser, then connect.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {MOBILE_WALLET_OPTIONS.map((wallet) => (
                      <a
                        key={wallet.id}
                        href={wallet.getMobileLink(dappUrl)}
                        className="flex items-center gap-2 p-3 rounded-2xl border border-stone-200 dark:border-white/10 hover:border-[#6393C4]/40 hover:bg-stone-50 dark:hover:bg-white/5 transition-colors text-sm font-medium text-[#030F1F] dark:text-white no-underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-[#6393C4] flex-shrink-0" />
                        {wallet.name}
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {!walletConnectReady && (
                <p className="text-xs text-amber-700 dark:text-amber-400/90 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-3 leading-relaxed">
                  For the best mobile experience from Chrome or Safari, set{' '}
                  <code className="text-[11px]">VITE_WALLETCONNECT_PROJECT_ID</code> in your env
                  (free at{' '}
                  <a
                    href="https://dashboard.reown.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-[#6393C4]"
                  >
                    dashboard.reown.com
                  </a>
                  ).
                </p>
              )}

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-3" role="alert">
                  {error}
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
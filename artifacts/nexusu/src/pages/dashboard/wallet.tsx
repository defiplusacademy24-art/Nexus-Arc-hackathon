/**
 * Wallet — balances, receive (deposit), and withdraw (send USDC).
 * Production path: Circle email wallet + Arc Testnet USDC.
 */

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wallet,
  AlertCircle,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { useWallet } from '@/providers/WalletProvider';
import { useWalletAssets } from '@/hooks/useWalletAssets';
import { useToast } from '@/hooks/use-toast';
import { ARC_EXPLORER_URL, ARC_TESTNET_CHAIN_ID, ARC_USDC_ERC20_ADDRESS } from '@/config/arc';
import { ARC_FAUCET_URL, ARC_NETWORK_LABEL } from '@/services/wallet/constants';
import {
  friendlyTransferError,
  transferErc20Usdc,
} from '@/services/wallet/transfer';
import { USDC_LOGO_URL } from '@/services/wallet/assets';
import { cn } from '@/lib/utils';
import { isAddress } from 'viem';

type Panel = 'receive' | 'withdraw' | null;

function formatUsdc(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

export default function WalletPage() {
  const { identity, walletAddress, disconnect, chainId, isOnArcTestnet, isConnected } =
    useWallet();
  const assets = useWalletAssets();
  const { toast } = useToast();

  const [panel, setPanel] = useState<Panel>(null);
  const [copied, setCopied] = useState(false);

  // Withdraw form
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const erc20 = useMemo(
    () => assets.data?.assets.find((a) => a.coinId === ARC_USDC_ERC20_ADDRESS),
    [assets.data],
  );

  const availableUsdc = useMemo(() => {
    const n = Number.parseFloat(erc20?.balance ?? '0');
    return Number.isFinite(n) ? n : 0;
  }, [erc20?.balance]);

  const portfolio = availableUsdc;

  const copyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      toast({ title: 'Wallet address copied', duration: 2000 });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const openPanel = (p: Panel) => {
    setPanel(p);
    setError(null);
    setSuccess(null);
    setLastTx(null);
  };

  const onWithdraw = async () => {
    if (!walletAddress) {
      setError('Sign in to withdraw funds.');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    setLastTx(null);
    try {
      const result = await transferErc20Usdc({
        from: walletAddress,
        to,
        amount,
      });
      setSuccess(
        `Sent ${formatUsdc(result.amount)} USDC successfully.`,
      );
      setLastTx(result.explorerUrl);
      setAmount('');
      setTo('');
      assets.refresh();
      toast({
        title: 'Withdrawal submitted',
        description: `${formatUsdc(result.amount)} USDC sent`,
      });
    } catch (e) {
      setError(friendlyTransferError(e));
    } finally {
      setBusy(false);
    }
  };

  const setMax = () => {
    setAmount(availableUsdc > 0 ? String(availableUsdc) : '');
  };

  if (!isConnected || !identity) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-stone-100 dark:bg-white/6 flex items-center justify-center mb-4">
            <Wallet className="w-8 h-8 text-stone-300 dark:text-white/20" />
          </div>
          <h2 className="text-lg font-display font-bold text-stone-800 dark:text-white mb-2">
            Sign in to open your wallet
          </h2>
          <p className="text-sm text-stone-400 dark:text-white/40 mb-6 max-w-xs">
            Use your Circle email wallet to view balances, deposit, and withdraw USDC.
          </p>
          <Link
            href="/app"
            className="px-5 py-2.5 rounded-xl bg-[#6393C4] text-white text-sm font-semibold hover:bg-[#5289B8] transition-colors"
          >
            Sign in
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const explorerLink = walletAddress
    ? `${ARC_EXPLORER_URL}/address/${walletAddress}`
    : ARC_EXPLORER_URL;

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 py-5 sm:py-6 max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-start justify-between gap-3"
        >
          <div>
            <h1 className="text-xl font-display font-bold text-stone-900 dark:text-white">
              Wallet
            </h1>
            <p className="text-sm text-stone-400 dark:text-white/40 mt-0.5">
              {ARC_NETWORK_LABEL} · manage your USDC
            </p>
          </div>
          <button
            type="button"
            onClick={() => assets.refresh()}
            disabled={assets.isLoading}
            className="p-2 rounded-xl border border-stone-200 dark:border-white/10 text-stone-500 dark:text-white/50 hover:bg-stone-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
            aria-label="Refresh balances"
          >
            <RefreshCw className={cn('w-4 h-4', assets.isLoading && 'animate-spin')} />
          </button>
        </motion.div>

        {/* Balance hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="relative overflow-hidden rounded-2xl p-5 sm:p-6 mb-4 text-white
            bg-gradient-to-br from-[#4A7FB0] via-[#6393C4] to-[#7AA8D4]
            shadow-[0_8px_32px_rgba(99,147,196,0.28)] border border-white/10"
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 100% 0%, rgba(255,255,255,0.25), transparent 55%)',
            }}
          />
          <div className="relative">
            <div className="flex items-center gap-2 mb-1.5">
              <img src={USDC_LOGO_URL} alt="" className="w-5 h-5 rounded-full bg-white shadow-sm" />
              <p className="text-[11px] font-semibold text-white/70 uppercase tracking-[0.08em]">
                Available balance
              </p>
            </div>
            <p className="text-3xl sm:text-[2.5rem] font-display font-semibold tabular-nums tracking-tight leading-none">
              {assets.isLoading && !erc20 ? (
                <span className="opacity-70">…</span>
              ) : (
                <>
                  ${formatUsdc(portfolio)}
                  <span className="text-base font-semibold text-white/75 ml-1.5">USDC</span>
                </>
              )}
            </p>
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-black/10 backdrop-blur-sm rounded-full px-2.5 py-1 border border-white/10">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                {isOnArcTestnet ? 'Arc Testnet' : 'Check network'}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => openPanel(panel === 'receive' ? null : 'receive')}
                className={cn(
                  'flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all',
                  panel === 'receive'
                    ? 'bg-white text-[#4A7FB0] shadow-md'
                    : 'bg-white/15 hover:bg-white/25 text-white border border-white/10',
                )}
              >
                <ArrowDownLeft className="w-4 h-4" />
                Deposit
              </button>
              <button
                type="button"
                onClick={() => openPanel(panel === 'withdraw' ? null : 'withdraw')}
                className={cn(
                  'flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all',
                  panel === 'withdraw'
                    ? 'bg-white text-[#4A7FB0] shadow-md'
                    : 'bg-white/15 hover:bg-white/25 text-white border border-white/10',
                )}
              >
                <ArrowUpRight className="w-4 h-4" />
                Withdraw
              </button>
            </div>
          </div>
        </motion.div>

        {/* Deposit / Withdraw panels */}
        <AnimatePresence mode="wait">
          {panel === 'receive' && (
            <motion.div
              key="receive"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="surface-card p-5 mb-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                <h2 className="text-sm font-semibold text-stone-800 dark:text-white tracking-tight">
                  Deposit
                </h2>
              </div>
              <p className="text-xs text-stone-400 dark:text-white/40 mb-4">
                Send Arc Testnet USDC to this address, or fund from Circle’s faucet. Only send assets
                on Arc Testnet.
              </p>

              <p className="text-[10px] font-semibold text-stone-400 dark:text-white/30 uppercase tracking-widest mb-2">
                Your wallet address
              </p>
              <button
                type="button"
                onClick={copyAddress}
                className="w-full text-left group rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-[#2E3B4B]/40 px-3.5 py-3 hover:border-[#6393C4]/40 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <p className="flex-1 font-mono text-xs sm:text-sm text-stone-700 dark:text-white/85 break-all leading-relaxed">
                    {walletAddress}
                  </p>
                  <span className="flex-shrink-0 p-1.5 rounded-lg text-stone-400 group-hover:text-[#6393C4] group-hover:bg-[#6393C4]/10">
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 dark:text-white/35 mt-2">
                  Tap to copy
                </p>
              </button>

              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <a
                  href={ARC_FAUCET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#6393C4] text-white text-sm font-semibold hover:bg-[#5289B8] transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Get testnet USDC
                </a>
                <Link
                  href="/dashboard/treasury"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-stone-200 dark:border-white/10 text-sm font-semibold text-stone-600 dark:text-white/70 hover:bg-stone-50 dark:hover:bg-white/5 transition-colors"
                >
                  Deposit to treasury
                </Link>
              </div>
            </motion.div>
          )}

          {panel === 'withdraw' && (
            <motion.div
              key="withdraw"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="surface-card p-5 mb-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpRight className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-stone-800 dark:text-white tracking-tight">
                  Withdraw
                </h2>
              </div>
              <p className="text-xs text-stone-400 dark:text-white/40 mb-4">
                Send USDC from your wallet. You’ll confirm with your Circle PIN.
                Available:{' '}
                <span className="font-semibold text-stone-600 dark:text-white/70">
                  {formatUsdc(availableUsdc)} USDC
                </span>
              </p>

              <label className="block text-[10px] font-semibold text-stone-400 dark:text-white/30 uppercase tracking-widest mb-1.5">
                Recipient address
              </label>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value.trim())}
                placeholder="0x…"
                autoComplete="off"
                spellCheck={false}
                className="w-full mb-3 px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#2E3B4B]/40 border border-stone-200 dark:border-[#1A2A3A] font-mono text-xs sm:text-sm text-stone-700 dark:text-white placeholder:text-stone-300 dark:placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#6393C4]/30"
              />

              <label className="block text-[10px] font-semibold text-stone-400 dark:text-white/30 uppercase tracking-widest mb-1.5">
                Amount (USDC)
              </label>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#2E3B4B]/40 border border-stone-200 dark:border-[#1A2A3A] text-sm text-stone-700 dark:text-white placeholder:text-stone-300 dark:placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#6393C4]/30 tabular-nums"
                />
                <button
                  type="button"
                  onClick={setMax}
                  className="px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-white/10 text-xs font-semibold text-[#6393C4] hover:bg-[#6393C4]/8 transition-colors"
                >
                  Max
                </button>
              </div>

              {error && (
                <div className="mb-3 flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200/80 dark:border-red-500/20 px-3 py-2.5 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="mb-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/80 dark:border-emerald-500/20 px-3 py-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                  <p className="font-semibold">{success}</p>
                  {lastTx && (
                    <a
                      href={lastTx}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1.5 text-emerald-700 dark:text-emerald-400 underline-offset-2 hover:underline"
                    >
                      View on ArcScan <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={onWithdraw}
                disabled={
                  busy ||
                  !to ||
                  !amount ||
                  availableUsdc <= 0 ||
                  (to ? !isAddress(to) : true)
                }
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#6393C4] text-white text-sm font-semibold hover:bg-[#5289B8] transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Confirm in Circle…
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-4 h-4" />
                    Withdraw USDC
                  </>
                )}
              </button>
              <p className="text-[11px] text-stone-400 dark:text-white/35 mt-2.5 text-center">
                Double-check the address. Transfers on Arc cannot be reversed.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wallet details */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="surface-card p-5 mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-[#6393C4]" />
            <h2 className="text-sm font-semibold text-stone-800 dark:text-white tracking-tight">
              Details
            </h2>
          </div>

          {walletAddress && (
            <div className="py-3 border-b border-stone-50 dark:border-white/4">
              <p className="text-xs font-semibold text-stone-400 dark:text-white/30 uppercase tracking-widest mb-2">
                Address
              </p>
              <div className="flex items-start gap-2">
                <p className="flex-1 font-mono text-xs text-stone-700 dark:text-white/80 break-all">
                  {walletAddress}
                </p>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="flex-shrink-0 p-1.5 rounded-lg text-stone-400 hover:text-[#6393C4] hover:bg-[#6393C4]/10 transition-colors"
                  aria-label="Copy address"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}
          <div className="py-3 border-b border-stone-50 dark:border-white/4">
            <p className="text-xs font-semibold text-stone-400 dark:text-white/30 uppercase tracking-widest mb-1">
              Network
            </p>
            <p className="text-sm font-medium text-stone-700 dark:text-white/80">{ARC_NETWORK_LABEL}</p>
          </div>
          <div className="py-3">
            <p className="text-xs font-semibold text-stone-400 dark:text-white/30 uppercase tracking-widest mb-1">
              Chain ID
            </p>
            <p className="text-sm font-mono text-stone-700 dark:text-white/80">
              {String(chainId ?? ARC_TESTNET_CHAIN_ID)}
            </p>
          </div>
        </motion.div>

        {/* Security note */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="surface-card p-5 mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-[#6393C4]" />
            <h2 className="text-sm font-semibold text-stone-800 dark:text-white tracking-tight">
              Security
            </h2>
          </div>
          <ul className="space-y-2 text-[13px] text-stone-600 dark:text-white/60">
            <li className="flex gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              Non-custodial · PIN-confirmed transfers
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              Treasury funds stay in smart contracts
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              Verify recipient before withdraw
            </li>
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col gap-2.5"
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
          <button
            type="button"
            onClick={async () => {
              await disconnect();
              window.location.href = '/';
            }}
            className="py-3 rounded-xl border border-red-200 dark:border-red-500/20 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/8 transition-colors"
          >
            Sign out
          </button>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

/**
 * WalletBalanceCard — displays real Sphere SDK wallet balances.
 *
 * Data comes from sphere_getAssets (Asset[]) via useWalletAssets.
 * Amounts are pre-formatted by the assets service (formatUnits).
 * Never shows hard-coded or mock values.
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  Coins,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  Clock,
  Wallet,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type { UseWalletAssetsState } from '@/hooks/useWalletAssets';
import type { WalletAsset } from '@/services/unicity/assets';

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-stone-100 dark:bg-white/8 rounded-lg ${className}`} />;
}

// ── Portfolio total header ────────────────────────────────────────────────────
function PortfolioTotal({ usd }: { usd: number }) {
  return (
    <div className="px-5 py-4 bg-gradient-to-r from-[#E8461E]/5 to-[#F97316]/5 dark:from-[#E8461E]/10 dark:to-[#F97316]/8 border-b border-stone-100 dark:border-white/6">
      <p className="text-[10px] font-semibold text-stone-400 dark:text-white/35 uppercase tracking-widest mb-1">
        Portfolio Value
      </p>
      <p className="text-2xl font-display font-bold text-stone-900 dark:text-white">
        ${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

// ── 24h change pill ───────────────────────────────────────────────────────────
function ChangePill({ change24h }: { change24h: number }) {
  const positive = change24h > 0;
  const neutral = change24h === 0;
  const Icon = neutral ? Minus : positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
        neutral
          ? 'bg-stone-100 dark:bg-white/8 text-stone-400 dark:text-white/40'
          : positive
            ? 'bg-emerald-50 dark:bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
            : 'bg-red-50 dark:bg-red-500/12 text-red-600 dark:text-red-400'
      }`}
    >
      <Icon className="w-3 h-3" />
      {positive ? '+' : ''}{change24h.toFixed(2)}%
    </span>
  );
}

// ── Single asset row ──────────────────────────────────────────────────────────
function AssetRow({ asset, index }: { asset: WalletAsset; index: number }) {
  const ticker = asset.symbol.slice(0, 3).toUpperCase();
  const hasPending = !!asset.pendingBalance;
  const hasSending = !!asset.transferringBalance;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="flex items-center gap-3 p-3.5 rounded-xl bg-stone-50 dark:bg-white/4 border border-stone-100 dark:border-white/5"
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E8461E]/18 to-[#F97316]/12 dark:from-[#E8461E]/20 dark:to-[#F97316]/14 flex items-center justify-center flex-shrink-0 shadow-sm">
        {asset.iconUrl ? (
          <img src={asset.iconUrl} alt={asset.symbol} className="w-6 h-6 rounded-full" />
        ) : (
          <span className="text-[11px] font-bold text-[#E8461E]">{ticker}</span>
        )}
      </div>

      {/* Name + status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-sm font-semibold text-stone-800 dark:text-white truncate">{asset.name}</p>
          {asset.change24h !== null && <ChangePill change24h={asset.change24h} />}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-stone-400 dark:text-white/35 font-mono uppercase">{asset.symbol}</span>
          {hasPending && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500 dark:text-amber-400">
              <Clock className="w-2.5 h-2.5" />
              {asset.pendingBalance} pending
            </span>
          )}
          {hasSending && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-500 dark:text-blue-400">
              <ArrowUpRight className="w-2.5 h-2.5" />
              {asset.transferringBalance} sending
            </span>
          )}
        </div>
      </div>

      {/* Balance */}
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold text-stone-800 dark:text-white tabular-nums">
          {asset.balance} <span className="text-stone-400 dark:text-white/35 font-normal text-xs">{asset.symbol}</span>
        </p>
        {asset.fiatValueUsd !== null ? (
          <p className="text-xs text-stone-400 dark:text-white/35 tabular-nums">
            ≈ ${asset.fiatValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        ) : asset.priceUsd !== null ? (
          <p className="text-xs text-stone-400 dark:text-white/35">
            @ ${asset.priceUsd.toLocaleString()}
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}

// ── Confirmed badge ───────────────────────────────────────────────────────────
function ConfirmedBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="w-3 h-3" />
      {count} token{count !== 1 ? 's' : ''} confirmed
    </span>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ supported }: { supported: boolean }) {
  return (
    <div className="py-10 flex flex-col items-center gap-3 text-center">
      <div className="w-14 h-14 rounded-2xl bg-stone-100 dark:bg-white/6 flex items-center justify-center">
        <Wallet className="w-6 h-6 text-stone-300 dark:text-white/20" />
      </div>
      <div>
        <p className="text-sm font-semibold text-stone-600 dark:text-white/55 mb-1">
          {supported ? 'No assets in wallet' : 'Balance unavailable'}
        </p>
        <p className="text-xs text-stone-400 dark:text-white/30 max-w-[260px] leading-relaxed">
          {supported
            ? 'Your connected wallet has no assets on this network yet.'
            : 'Asset queries are not yet supported on this network. Try reconnecting your wallet.'}
        </p>
      </div>
      {!supported && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-500/8 border border-amber-200/60 dark:border-amber-500/15">
          <AlertCircle className="w-3 h-3 text-amber-500" />
          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
            Testnet · Balance queries not available
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────
export interface WalletBalanceCardProps {
  assets: UseWalletAssetsState;
  delay?: number;
}

export function WalletBalanceCard({ assets, delay = 0 }: WalletBalanceCardProps) {
  const { data, isLoading, error, refresh } = assets;

  const hasAssets = !isLoading && data?.supported && data.assets.length > 0;
  const isEmpty = !isLoading && (!data?.supported || data.assets.length === 0);
  const totalConfirmedTokens = data?.assets.reduce((s, a) => s + a.tokenCount, 0) ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-white/6 rounded-2xl overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="px-5 py-4 border-b border-stone-100 dark:border-white/6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Coins className="w-4 h-4 text-[#E8461E]" />
          <span className="text-sm font-semibold text-stone-800 dark:text-white">Wallet Assets</span>
        </div>
        <div className="flex items-center gap-3">
          {hasAssets && <ConfirmedBadge count={totalConfirmedTokens} />}
          {data?.lastUpdated && !isLoading && (
            <span className="text-[10px] text-stone-400 dark:text-white/25 tabular-nums">
              {data.lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-stone-400 dark:text-white/30 hover:text-[#E8461E] hover:bg-[#E8461E]/8 transition-colors disabled:opacity-40"
            aria-label="Refresh assets"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Portfolio total (when price data available) ── */}
      <AnimatePresence>
        {hasAssets && data?.portfolioValueUsd != null && (
          <motion.div
            key="portfolio-total"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <PortfolioTotal usd={data.portfolioValueUsd} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-5">
        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-4 w-40 mt-4" />
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-500/8 border border-red-100 dark:border-red-500/15 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Asset list */}
        {hasAssets && !error && (
          <div className="space-y-2.5">
            {data!.assets.map((asset, i) => (
              <AssetRow key={asset.coinId || `${asset.symbol}-${i}`} asset={asset} index={i} />
            ))}
          </div>
        )}

        {/* Empty / unsupported */}
        {isEmpty && !error && <EmptyState supported={data?.supported ?? false} />}

        {/* Network footer */}
        {!isLoading && data && (
          <div className="mt-4 pt-4 border-t border-stone-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-stone-300 dark:text-white/20" />
              <span className="text-[10px] text-stone-400 dark:text-white/30 uppercase tracking-wide font-semibold">
                Network: {data.network}
              </span>
            </div>
            {hasAssets && (
              <span className="text-[10px] text-stone-300 dark:text-white/20">
                {data.assets.length} asset{data.assets.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

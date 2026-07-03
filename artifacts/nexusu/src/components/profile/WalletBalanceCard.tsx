import { motion } from 'framer-motion';
import { Coins, RefreshCw, TrendingUp, AlertCircle } from 'lucide-react';
import type { UseWalletAssetsState } from '@/hooks/useWalletAssets';

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-stone-100 dark:bg-white/8 rounded-lg ${className}`} />
  );
}

interface WalletBalanceCardProps {
  assets: UseWalletAssetsState;
  delay?: number;
}

export function WalletBalanceCard({ assets, delay = 0 }: WalletBalanceCardProps) {
  const { data, isLoading, refresh } = assets;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-white/6 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-stone-100 dark:border-white/6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Coins className="w-4 h-4 text-[#E8461E]" />
          <span className="text-sm font-semibold text-stone-800 dark:text-white">
            Wallet Assets
          </span>
        </div>
        <div className="flex items-center gap-2">
          {data?.lastUpdated && !isLoading && (
            <span className="text-[10px] text-stone-400 dark:text-white/25">
              Updated {data.lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
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

      <div className="p-5">
        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-40" />
          </div>
        )}

        {/* Has assets */}
        {!isLoading && data?.supported && data.assets.length > 0 && (
          <div className="space-y-3">
            {data.assets.map((asset, i) => (
              <div
                key={asset.assetId ?? `${asset.symbol}-${i}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 dark:bg-white/4"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#E8461E]/15 to-[#F97316]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-[#E8461E]">
                    {asset.symbol.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-stone-800 dark:text-white">{asset.name}</p>
                  <p className="text-xs text-stone-400 dark:text-white/40">{asset.network}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-stone-800 dark:text-white">
                    {asset.balance} {asset.symbol}
                  </p>
                  {asset.estimatedValueUsd !== null && (
                    <p className="text-xs text-stone-400 dark:text-white/40">
                      ≈ ${asset.estimatedValueUsd.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SDK doesn't support asset queries yet — empty state */}
        {!isLoading && (!data?.supported || data.assets.length === 0) && (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-white/6 flex items-center justify-center">
              <Coins className="w-6 h-6 text-stone-300 dark:text-white/20" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-600 dark:text-white/60 mb-1">
                No assets visible
              </p>
              <p className="text-xs text-stone-400 dark:text-white/30 max-w-xs leading-relaxed">
                Asset balances will appear here once the Sphere SDK exposes wallet balance queries on this network.
              </p>
            </div>
            <div className="flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-500/8 border border-amber-200 dark:border-amber-500/15">
              <AlertCircle className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                Testnet · Balance queries not yet available
              </span>
            </div>
          </div>
        )}

        {/* Network tag */}
        {!isLoading && data && (
          <div className="mt-4 pt-4 border-t border-stone-100 dark:border-white/5 flex items-center gap-2">
            <TrendingUp className="w-3 h-3 text-stone-300 dark:text-white/20" />
            <span className="text-[10px] text-stone-400 dark:text-white/30 uppercase tracking-wide font-semibold">
              Network: {data.network}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

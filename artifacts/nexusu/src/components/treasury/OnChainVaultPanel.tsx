/**
 * On-chain CooperativeTreasuryVault panel — primary deposit path for Treasury.
 * Create/join cooperative → deposit; membership is auto-joined on-chain (or via
 * server bootstrap for older vault deploys). No separate registration UI.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownLeft,
  ExternalLink,
  Loader2,
  RefreshCw,
  Settings2,
  Shield,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { useWallet } from '@/providers/WalletProvider';
import { useCooperative } from '@/providers/CooperativeProvider';
import { formatCurrency } from '@/utils/format';
import { ARC_EXPLORER_URL, ARC_FAUCET_URL } from '@/config/arc';
import { TREASURY_VAULT_ADDRESS, MIN_CONTRIBUTION_USDC } from '@/config/treasury-vault';
import {
  applyCoopRulesToVault,
  depositToVault,
  fetchVaultSnapshot,
  formatFrequencyLabel,
  friendlyVaultError,
  isVaultConfigured,
  rulesOutOfSync,
  triggerVaultPayout,
  type VaultSnapshot,
} from '@/services/treasury/vault';
import { cn } from '@/lib/utils';
import type { ContributionFrequency } from '@/types';

function shortAddr(a: string | null | undefined): string {
  if (!a) return '—';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function statusLabel(s: VaultSnapshot['contributionStatus']): string {
  switch (s) {
    case 'paid':
      return 'Paid this cycle';
    case 'exempt':
      return 'Exempt';
    case 'waiting':
      return 'Ready to contribute';
    default:
      return '—';
  }
}

export type OnChainDepositResult = {
  amount: number;
};

type Props = {
  /** Called after a successful on-chain contribution so the app ledger can stay in sync. */
  onDepositSuccess?: (result: OnChainDepositResult) => void | Promise<void>;
};

export function OnChainVaultPanel({ onDepositSuccess }: Props) {
  const { walletAddress, isConnected, isCircleEmailWallet } = useWallet();
  const { activeCooperative } = useCooperative();
  const configured = isVaultConfigured();
  const [snap, setSnap] = useState<VaultSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'deposit' | 'payout' | 'sync' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const coopAmount = activeCooperative?.contributionAmount;
  const coopFrequency = activeCooperative?.contributionFrequency as
    | ContributionFrequency
    | undefined;

  const outOfSync = useMemo(
    () => rulesOutOfSync(snap, coopAmount, coopFrequency),
    [snap, coopAmount, coopFrequency],
  );

  const refresh = useCallback(
    async (opts?: { softRateLimit?: boolean }) => {
      if (!configured) {
        setSnap(null);
        return;
      }
      setLoading(true);
      if (!opts?.softRateLimit) setError(null);
      try {
        const data = await fetchVaultSnapshot(walletAddress);
        setSnap(data);
        if (opts?.softRateLimit) setError(null);
      } catch (e) {
        const msg = friendlyVaultError(e);
        const isRateLimit = /rate limited|busy \(rate|request limit/i.test(msg);
        if (opts?.softRateLimit && isRateLimit) return;
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [configured, walletAddress],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onDeposit = async () => {
    if (!isConnected) {
      setError('Connect your wallet first');
      return;
    }
    setBusy('deposit');
    setError(null);
    setSuccess(null);
    try {
      const { amount } = await depositToVault({ walletAddress });
      setSuccess(`Contribution of ${formatCurrency(amount)} submitted.`);
      if (onDepositSuccess) {
        await onDepositSuccess({ amount });
      }
      await new Promise((r) => setTimeout(r, 2500));
      await refresh({ softRateLimit: true });
    } catch (e) {
      setError(friendlyVaultError(e));
    } finally {
      setBusy(null);
    }
  };

  const onPayout = async () => {
    setBusy('payout');
    setError(null);
    setSuccess(null);
    try {
      await triggerVaultPayout();
      setSuccess('Payout submitted.');
      await new Promise((r) => setTimeout(r, 2500));
      await refresh({ softRateLimit: true });
    } catch (e) {
      setError(friendlyVaultError(e));
    } finally {
      setBusy(null);
    }
  };

  const onSyncRules = async () => {
    if (!activeCooperative) {
      setError('Select a cooperative first');
      return;
    }
    if ((coopAmount ?? 0) < MIN_CONTRIBUTION_USDC) {
      setError(`Cooperative contribution must be at least $${MIN_CONTRIBUTION_USDC}.`);
      return;
    }
    setBusy('sync');
    setError(null);
    setSuccess(null);
    try {
      await applyCoopRulesToVault({
        amountUsd: coopAmount!,
        frequency: coopFrequency ?? 'monthly',
      });
      setSuccess(
        `Vault rules updated to ${formatCurrency(coopAmount!)} · ${formatFrequencyLabel(coopFrequency)}.`,
      );
      await new Promise((r) => setTimeout(r, 2500));
      await refresh({ softRateLimit: true });
    } catch (e) {
      setError(friendlyVaultError(e));
    } finally {
      setBusy(null);
    }
  };

  if (!configured) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-stone-900/60 border border-dashed border-stone-200 dark:border-white/15 rounded-2xl p-5 mb-6"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#6393C4]/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-[#6393C4]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-stone-800 dark:text-white">
              On-chain Treasury Vault (Arc)
            </h2>
            <p className="text-xs text-stone-500 dark:text-white/45 mt-1 leading-relaxed">
              Deploy the vault and set{' '}
              <code className="text-[11px] font-mono">VITE_TREASURY_VAULT_ADDRESS</code>.
            </p>
            <a
              href={ARC_FAUCET_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-[#6393C4] hover:underline"
            >
              Get Arc testnet USDC <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </motion.div>
    );
  }

  const explorerVault = `${ARC_EXPLORER_URL}/address/${TREASURY_VAULT_ADDRESS}`;
  const displayAmount = snap?.contributionAmount ?? coopAmount ?? 0;
  const displayFreq = snap?.contributionFrequency ?? coopFrequency ?? null;

  const depositDisabled =
    !isConnected ||
    busy !== null ||
    snap?.contributionStatus === 'paid' ||
    snap?.canDepositNow === false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5 mb-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-stone-800 dark:text-white">
              Member contribution
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
              On-chain · Arc
            </span>
          </div>
          <p className="text-xs text-stone-400 dark:text-white/40 mt-0.5">
            {formatCurrency(displayAmount)}
            {displayFreq ? ` · ${formatFrequencyLabel(displayFreq)}` : ''}
            {isCircleEmailWallet ? ' · Circle PIN' : ''}
          </p>
          <a
            href={explorerVault}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 mt-1 text-[11px] font-mono text-[#6393C4] hover:underline"
          >
            {shortAddr(TREASURY_VAULT_ADDRESS)} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading || busy !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-white/10 text-xs text-stone-500 dark:text-white/50 hover:border-stone-300 dark:hover:border-white/20 disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {activeCooperative && outOfSync && snap?.isOrganizer && (
        <div className="mb-4 rounded-xl border border-stone-100 dark:border-white/8 bg-stone-50 dark:bg-[#2E3B4B]/30 px-3.5 py-3">
          <p className="text-xs text-stone-600 dark:text-white/60 mb-2">
            Coop rules differ from vault. Sync {formatCurrency(coopAmount ?? 0)} ·{' '}
            {formatFrequencyLabel(coopFrequency)} on-chain?
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void onSyncRules()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50"
          >
            {busy === 'sync' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Settings2 className="w-3.5 h-3.5" />
            )}
            Apply coop rules
          </button>
        </div>
      )}

      {snap && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="rounded-xl bg-stone-50 dark:bg-[#2E3B4B]/35 border border-stone-100 dark:border-white/6 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-white/35">
                Vault balance
              </p>
              <p className="text-base font-display font-bold text-stone-800 dark:text-white mt-0.5">
                {formatCurrency(snap.totalBalance)}
              </p>
            </div>
            <div className="rounded-xl bg-stone-50 dark:bg-[#2E3B4B]/35 border border-stone-100 dark:border-white/6 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-white/35">
                Per cycle
              </p>
              <p className="text-base font-display font-bold text-stone-800 dark:text-white mt-0.5">
                {formatCurrency(displayAmount)}
              </p>
            </div>
            <div className="rounded-xl bg-stone-50 dark:bg-[#2E3B4B]/35 border border-stone-100 dark:border-white/6 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-white/35">
                Cycle
              </p>
              <p className="text-base font-display font-bold text-stone-800 dark:text-white mt-0.5">
                #{snap.currentCycle}
              </p>
            </div>
            <div className="rounded-xl bg-stone-50 dark:bg-[#2E3B4B]/35 border border-stone-100 dark:border-white/6 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-white/35">
                Paid
              </p>
              <p className="text-base font-display font-bold text-stone-800 dark:text-white mt-0.5">
                {snap.paidCount}/{snap.requiredCount || '—'}
              </p>
            </div>
          </div>

          {snap.breakdown && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {(
                [
                  ['Rotation', snap.breakdown.rotationFund],
                  ['Loans', snap.breakdown.loanPool],
                  ['Emergency', snap.breakdown.emergencyReserve],
                  ['Savings', snap.breakdown.savingsInvestment],
                ] as const
              ).map(([label, val]) => (
                <div
                  key={label}
                  className="rounded-lg border border-stone-100 dark:border-white/6 px-2.5 py-2"
                >
                  <p className="text-[10px] text-stone-400 dark:text-white/35">{label}</p>
                  <p className="text-sm font-semibold text-stone-700 dark:text-white/85">
                    {formatCurrency(val)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 mb-4 text-xs text-stone-500 dark:text-white/50">
            <div className="flex items-center gap-2 flex-1 rounded-xl border border-stone-100 dark:border-white/8 px-3 py-2">
              <Users className="w-4 h-4 text-[#6393C4] flex-shrink-0" />
              <div>
                <p className="font-medium text-stone-700 dark:text-white/80">
                  Recipient · #{snap.currentPosition}
                </p>
                <p className="font-mono">{shortAddr(snap.currentRecipient)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-1 rounded-xl border border-stone-100 dark:border-white/8 px-3 py-2">
              <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-stone-700 dark:text-white/80">
                  Next · #{snap.nextPosition}
                </p>
                <p className="font-mono">{shortAddr(snap.nextRecipient)}</p>
              </div>
            </div>
          </div>

          {isConnected && (
            <p className="text-xs text-stone-500 dark:text-white/45 mb-3">
              Status:{' '}
              <span className="font-semibold text-stone-700 dark:text-white/75">
                {snap.isMember
                  ? `${statusLabel(snap.contributionStatus)}${
                      snap.joinPosition ? ` · #${snap.joinPosition}` : ''
                    }`
                  : 'Ready to deposit'}
              </span>
              {snap.canDepositNow === false &&
                snap.canDepositReason === 'too_early_for_frequency' && (
                  <span className="text-amber-700 dark:text-amber-400">
                    {' '}
                    · Next window after{' '}
                    {formatFrequencyLabel(displayFreq).toLowerCase()} period
                    {snap.nextContributionAt
                      ? ` (${new Date(snap.nextContributionAt * 1000).toLocaleDateString()})`
                      : ''}
                  </span>
                )}
            </p>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={depositDisabled}
          onClick={() => void onDeposit()}
          className={cn(
            'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors disabled:opacity-50',
          )}
        >
          {busy === 'deposit' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowDownLeft className="w-4 h-4" />
          )}
          Deposit {displayAmount > 0 ? formatCurrency(displayAmount) : ''} on-chain
        </button>

        <button
          type="button"
          disabled={!snap?.canPayout || busy !== null}
          onClick={() => void onPayout()}
          className={cn(
            'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#6393C4] hover:bg-[#5289B8] transition-colors disabled:opacity-50',
          )}
        >
          {busy === 'payout' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          Trigger payout
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400 leading-relaxed break-words">
          {friendlyVaultError(error)}
        </p>
      )}
      {success && (
        <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400 leading-relaxed">
          {success}
        </p>
      )}
    </motion.div>
  );
}

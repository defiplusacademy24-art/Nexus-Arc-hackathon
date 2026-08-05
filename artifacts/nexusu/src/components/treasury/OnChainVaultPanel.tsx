/**
 * On-chain CooperativeTreasuryVault — deposit + balances only.
 * Rotation / “who is next” lives on the Members page.
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
  Zap,
} from 'lucide-react';
import { useWallet } from '@/providers/WalletProvider';
import { useCooperative } from '@/providers/CooperativeProvider';
import { formatCurrency } from '@/utils/format';
import { ARC_EXPLORER_URL } from '@/config/arc';
import { MIN_CONTRIBUTION_USDC } from '@/config/treasury-vault';
import {
  applyCoopRulesToVault,
  depositToVault,
  fetchVaultSnapshot,
  formatFrequencyLabel,
  friendlyVaultError,
  isVaultConfigured,
  resolveVaultAddress,
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

export type OnChainDepositResult = {
  amount: number;
};

type Props = {
  onDepositSuccess?: (result: OnChainDepositResult) => void | Promise<void>;
};

export function OnChainVaultPanel({ onDepositSuccess }: Props) {
  const { walletAddress, isConnected } = useWallet();
  const { activeCooperative, updateCooperative } = useCooperative();
  const vaultAddr = activeCooperative?.treasuryVaultAddress ?? null;
  const configured = isVaultConfigured(vaultAddr);
  const resolvedVault = resolveVaultAddress(vaultAddr);
  const [snap, setSnap] = useState<VaultSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'deposit' | 'payout' | 'sync' | 'provision' | null>(null);
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
      if (!configured || !vaultAddr) {
        setSnap(null);
        return;
      }
      setLoading(true);
      if (!opts?.softRateLimit) setError(null);
      try {
        // Always scope reads to this workspace's vault — never a shared global vault
        const data = await fetchVaultSnapshot(walletAddress, vaultAddr);
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
    [configured, walletAddress, vaultAddr],
  );

  useEffect(() => {
    void refresh();
  }, [refresh, activeCooperative?.id]);

  const onProvisionVault = async () => {
    if (!walletAddress || !activeCooperative) {
      setError('Connect your wallet and select a cooperative first');
      return;
    }
    setBusy('provision');
    setError(null);
    setSuccess(null);
    try {
      const { apiProvisionCoopVault } = await import('@/services/notifications/api');
      const res = await apiProvisionCoopVault(walletAddress, activeCooperative.id);
      const addr = res.vault || res.cooperative?.treasuryVaultAddress;
      const pool = res.loanPool || res.cooperative?.loanPoolAddress;
      if (addr) {
        updateCooperative(activeCooperative.id, {
          treasuryVaultAddress: addr,
          loanPoolAddress: pool ? String(pool) : activeCooperative.loanPoolAddress,
        });
        setSuccess(
          pool
            ? `Isolated vault + loan pool ready (30% of deposits fund lending).`
            : `Isolated treasury vault ready: ${String(addr).slice(0, 8)}…`,
        );
      } else {
        setError('Vault provision returned no address');
      }
    } catch (e) {
      setError(friendlyVaultError(e));
    } finally {
      setBusy(null);
    }
  };

  const onDeposit = async () => {
    if (!isConnected) {
      setError('Connect your wallet first');
      return;
    }
    if (!vaultAddr) {
      setError('This cooperative has no isolated vault yet. Provision a vault first.');
      return;
    }
    setBusy('deposit');
    setError(null);
    setSuccess(null);
    try {
      const result = await depositToVault({ walletAddress, vaultAddress: vaultAddr });
      const link = result.explorerUrl ? ` · ${result.explorerUrl}` : '';
      setSuccess(`Deposited ${formatCurrency(result.amount)} confirmed on Arc.${link}`);
      if (onDepositSuccess) {
        await onDepositSuccess({ amount: result.amount });
      }
      await refresh({ softRateLimit: true });
    } catch (e) {
      setError(friendlyVaultError(e));
    } finally {
      setBusy(null);
    }
  };

  const onPayout = async () => {
    if (!isConnected) {
      setError('Connect your wallet first');
      return;
    }
    if (!vaultAddr) {
      setError('This cooperative has no isolated vault yet.');
      return;
    }
    setBusy('payout');
    setError(null);
    setSuccess(null);
    try {
      await triggerVaultPayout({ walletAddress, vaultAddress: vaultAddr });
      setSuccess('Payout claimed.');
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
    if (!vaultAddr) {
      setError('This cooperative has no isolated vault yet. Provision a vault first.');
      return;
    }
    if ((coopAmount ?? 0) < MIN_CONTRIBUTION_USDC) {
      setError(`Contribution must be at least $${MIN_CONTRIBUTION_USDC}.`);
      return;
    }
    setBusy('sync');
    setError(null);
    setSuccess(null);
    try {
      await applyCoopRulesToVault({
        amountUsd: coopAmount!,
        frequency: coopFrequency ?? 'monthly',
        vaultAddress: vaultAddr,
      });
      setSuccess('Vault rules updated.');
      await new Promise((r) => setTimeout(r, 2500));
      await refresh({ softRateLimit: true });
    } catch (e) {
      setError(friendlyVaultError(e));
    } finally {
      setBusy(null);
    }
  };

  if (!configured || !vaultAddr) {
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
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-stone-800 dark:text-white">
              Treasury Vault
            </h2>
            <p className="text-xs text-stone-500 dark:text-white/45 mt-1">
              Each cooperative needs its own isolated vault. This workspace has none yet —
              provision one so deposits and balances stay separate from other groups.
            </p>
            {activeCooperative && (
              <button
                type="button"
                onClick={() => void onProvisionVault()}
                disabled={busy === 'provision' || !walletAddress}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#6393C4] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {busy === 'provision' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                Provision isolated vault
              </button>
            )}
            {error && (
              <p className="text-xs text-red-500 mt-2">{error}</p>
            )}
            {success && (
              <p className="text-xs text-emerald-600 mt-2">{success}</p>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  const explorerVault = `${ARC_EXPLORER_URL}/address/${resolvedVault ?? vaultAddr}`;
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
          <h2 className="text-sm font-semibold text-stone-800 dark:text-white">Contribute</h2>
          <p className="text-xs text-stone-400 dark:text-white/40 mt-0.5">
            {formatCurrency(displayAmount)}
            {displayFreq ? ` · ${formatFrequencyLabel(displayFreq)}` : ''}
          </p>
          <a
            href={explorerVault}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 mt-1 text-[11px] font-mono text-[#6393C4] hover:underline"
          >
            {shortAddr(resolvedVault ?? vaultAddr)} <ExternalLink className="w-3 h-3" />
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
        <div className="mb-4 rounded-xl border border-stone-100 dark:border-white/8 bg-stone-50 dark:bg-[#2E3B4B]/30 px-3.5 py-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-stone-600 dark:text-white/60">
            Update vault to {formatCurrency(coopAmount ?? 0)} · {formatFrequencyLabel(coopFrequency)}
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
            Apply
          </button>
        </div>
      )}

      {snap && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl bg-stone-50 dark:bg-[#2E3B4B]/35 border border-stone-100 dark:border-white/6 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-white/35">
              In vault
            </p>
            <p className="text-base font-display font-bold text-stone-800 dark:text-white mt-0.5">
              {formatCurrency(snap.totalBalance)}
            </p>
          </div>
          <div className="rounded-xl bg-stone-50 dark:bg-[#2E3B4B]/35 border border-stone-100 dark:border-white/6 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-white/35">
              Amount
            </p>
            <p className="text-base font-display font-bold text-stone-800 dark:text-white mt-0.5">
              {formatCurrency(displayAmount)}
            </p>
          </div>
          <div className="rounded-xl bg-stone-50 dark:bg-[#2E3B4B]/35 border border-stone-100 dark:border-white/6 px-3 py-2.5 col-span-2 sm:col-span-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-white/35">
              This cycle
            </p>
            <p className="text-base font-display font-bold text-stone-800 dark:text-white mt-0.5">
              {snap.paidCount}/{snap.requiredCount || '—'} paid
            </p>
          </div>
        </div>
      )}

      {isConnected && snap?.canDepositNow === false && snap.canDepositReason === 'too_early_for_frequency' && (
        <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
          Next contribution after your {formatFrequencyLabel(displayFreq).toLowerCase()} period
          {snap.nextContributionAt
            ? ` (${new Date(snap.nextContributionAt * 1000).toLocaleDateString()})`
            : ''}
          .
        </p>
      )}

      {snap && !snap.canPayout && (
        <p className="text-xs text-stone-500 dark:text-white/45 mb-3">
          {!snap.allMembersPaid
            ? `${snap.paidCount}/${snap.requiredCount || '—'} paid this period`
            : snap.currentRecipient
              ? `Claim available for ${shortAddr(snap.currentRecipient)}${
                  snap.currentPosition ? ` · #${snap.currentPosition}` : ''
                }`
              : 'Waiting for payout recipient'}
        </p>
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
          Deposit {displayAmount > 0 ? formatCurrency(displayAmount) : ''}
        </button>

        <button
          type="button"
          disabled={!snap?.canPayout || busy !== null}
          onClick={() => void onPayout()}
          title={
            !snap?.allMembersPaid
              ? `Waiting for all members to contribute (${snap?.paidCount ?? 0}/${snap?.requiredCount ?? '—'} paid)`
              : !snap?.isCurrentRecipient
                ? 'Only the current payout-queue recipient can claim'
                : 'Claim your full cycle pot'
          }
          className={cn(
            'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#6393C4] hover:bg-[#5289B8] transition-colors disabled:opacity-50',
          )}
        >
          {busy === 'payout' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          Claim payout
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400 break-words">
          {friendlyVaultError(error)}
        </p>
      )}
      {success && (
        <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{success}</p>
      )}
    </motion.div>
  );
}

/**
 * On-chain CooperativeTreasuryVault panel — primary deposit path for Treasury.
 * Requires VITE_TREASURY_VAULT_ADDRESS after forge deploy.
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
  bootstrapCircleWalletOnVault,
  depositToVault,
  fetchVaultOperatorStatus,
  fetchVaultSnapshot,
  formatFrequencyLabel,
  friendlyVaultError,
  isVaultConfigured,
  registerMemberOnVault,
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
      return 'Waiting contribution';
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
  const [busy, setBusy] = useState<'deposit' | 'payout' | 'register' | 'sync' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [operatorConfigured, setOperatorConfigured] = useState<boolean | null>(null);

  const coopAmount = activeCooperative?.contributionAmount;
  const coopFrequency = activeCooperative?.contributionFrequency as
    | ContributionFrequency
    | undefined;

  const outOfSync = useMemo(
    () => rulesOutOfSync(snap, coopAmount, coopFrequency),
    [snap, coopAmount, coopFrequency],
  );

  /** Deploy-key organizer ≠ Circle login address (common after forge deploy). */
  const walletVsOrganizerMismatch = useMemo(() => {
    if (!walletAddress || !snap?.organizer) return false;
    return walletAddress.toLowerCase() !== snap.organizer.toLowerCase();
  }, [walletAddress, snap?.organizer]);

  useEffect(() => {
    void fetchVaultOperatorStatus().then((s) => setOperatorConfigured(s.configured));
  }, []);

  /**
   * Load vault snapshot. After a successful write, use softRateLimit so a busy
   * Arc RPC refresh does not look like the deposit/payout itself failed.
   */
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
        if (opts?.softRateLimit && isRateLimit) {
          // Tx already submitted — leave success visible; user can Refresh later.
          return;
        }
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
      const { amount } = await depositToVault();
      setSuccess(
        `On-chain contribution of ${formatCurrency(amount)} submitted. Complete any PIN / wallet prompts.`,
      );
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
      setSuccess('Payout transaction submitted. Rotation advances after confirmation.');
      await new Promise((r) => setTimeout(r, 2500));
      await refresh({ softRateLimit: true });
    } catch (e) {
      setError(friendlyVaultError(e));
    } finally {
      setBusy(null);
    }
  };

  /**
   * Register the logged-in Circle wallet on the vault.
   * Prefer server bootstrap (deploy key) when configured — Circle users cannot
   * call onlyOrganizer functions until they *are* the organizer.
   */
  const onRegisterSelf = async () => {
    if (!walletAddress) {
      setError('Connect your wallet first');
      return;
    }
    setBusy('register');
    setError(null);
    setSuccess(null);
    try {
      // 1) Server operator path (works while deploy key is still organizer)
      if (operatorConfigured) {
        const result = await bootstrapCircleWalletOnVault(walletAddress, {
          claimOrganizer: true,
        });
        setSuccess(result.message);
        await new Promise((r) => setTimeout(r, 2000));
        await refresh({ softRateLimit: true });
        return;
      }

      // 2) Direct on-chain path — only works if this Circle wallet is already organizer
      if (snap?.isOrganizer) {
        await registerMemberOnVault(walletAddress as `0x${string}`);
        setSuccess('Member registration submitted. Complete wallet / PIN prompt.');
        await new Promise((r) => setTimeout(r, 2500));
        await refresh({ softRateLimit: true });
        return;
      }

      throw new Error(
        'Circle wallet is not registered yet, and the server has no VAULT_OPERATOR_PRIVATE_KEY. ' +
          'Set that env (deploy key) on Vercel, or run contracts/script/BootstrapCircleFounder.s.sol once with CIRCLE_FOUNDER=your Circle address.',
      );
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
        `Vault rules updated to ${formatCurrency(coopAmount!)} · ${formatFrequencyLabel(coopFrequency)}. Complete wallet / PIN prompt.`,
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
              Deposits settle in USDC on Arc. Deploy{' '}
              <code className="text-[11px] font-mono">CooperativeTreasuryVault</code>, set{' '}
              <code className="text-[11px] font-mono">VITE_TREASURY_VAULT_ADDRESS</code>, and rebuild.
              Founder rules (amount ≥ ${MIN_CONTRIBUTION_USDC}, weekly / bi-weekly / monthly) are
              written on-chain.
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
  const displayFreq =
    snap?.contributionFrequency ?? coopFrequency ?? null;

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
            Fixed amount set by the founder · USDC on Arc
            {isCircleEmailWallet ? ' · Circle PIN signing' : ''}
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

      {/* Founder rules strip */}
      {activeCooperative && (
        <div className="mb-4 rounded-xl border border-stone-100 dark:border-white/8 bg-stone-50 dark:bg-[#2E3B4B]/30 px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-white/35 mb-1.5">
            Cooperative rules (founder)
          </p>
          <p className="text-sm font-semibold text-stone-800 dark:text-white">
            {formatCurrency(coopAmount ?? 0)} · {formatFrequencyLabel(coopFrequency)}
          </p>
          <p className="text-[11px] text-stone-500 dark:text-white/45 mt-1">
            On-chain vault:{' '}
            <span className="font-medium text-stone-700 dark:text-white/70">
              {snap
                ? `${formatCurrency(snap.contributionAmount)} · ${formatFrequencyLabel(snap.contributionFrequency)}`
                : 'loading…'}
            </span>
          </p>
          {outOfSync && snap?.isOrganizer && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void onSyncRules()}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50"
            >
              {busy === 'sync' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Settings2 className="w-3.5 h-3.5" />
              )}
              Apply coop rules on-chain
            </button>
          )}
          {outOfSync && !snap?.isOrganizer && (
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
              Vault amount differs from coop rules. Only the founder/organizer wallet can sync them
              on-chain.
            </p>
          )}
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
                Per-cycle amount
              </p>
              <p className="text-base font-display font-bold text-stone-800 dark:text-white mt-0.5">
                {formatCurrency(displayAmount)}
              </p>
              <p className="text-[10px] text-stone-400 dark:text-white/35 mt-0.5">
                {formatFrequencyLabel(displayFreq)}
              </p>
            </div>
            <div className="rounded-xl bg-stone-50 dark:bg-[#2E3B4B]/35 border border-stone-100 dark:border-white/6 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-white/35">
                Current cycle
              </p>
              <p className="text-base font-display font-bold text-stone-800 dark:text-white mt-0.5">
                #{snap.currentCycle}
              </p>
            </div>
            <div className="rounded-xl bg-stone-50 dark:bg-[#2E3B4B]/35 border border-stone-100 dark:border-white/6 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-white/35">
                Contributions
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
                  ['Rotation fund', snap.breakdown.rotationFund],
                  ['Loan pool', snap.breakdown.loanPool],
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
                  Current recipient · pos #{snap.currentPosition}
                </p>
                <p className="font-mono">{shortAddr(snap.currentRecipient)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-1 rounded-xl border border-stone-100 dark:border-white/8 px-3 py-2">
              <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-stone-700 dark:text-white/80">
                  Next · pos #{snap.nextPosition}
                </p>
                <p className="font-mono">{shortAddr(snap.nextRecipient)}</p>
              </div>
            </div>
          </div>

          {isConnected && (
            <div className="text-xs text-stone-500 dark:text-white/45 mb-3 space-y-1">
              <p>
                Your status:{' '}
                <span className="font-semibold text-stone-700 dark:text-white/75">
                  {snap.isMember
                    ? `${statusLabel(snap.contributionStatus)}${
                        snap.joinPosition ? ` · position #${snap.joinPosition}` : ''
                      }`
                    : 'Not registered on vault'}
                </span>
                {snap.isOrganizer ? ' · Organizer' : ''}
              </p>
              <p>
                Your Circle wallet:{' '}
                <span className="font-mono font-medium text-stone-700 dark:text-white/70">
                  {shortAddr(walletAddress)}
                </span>
                {snap.organizer ? (
                  <>
                    {' '}
                    · Vault organizer:{' '}
                    <span className="font-mono font-medium text-stone-700 dark:text-white/70">
                      {shortAddr(snap.organizer)}
                    </span>
                  </>
                ) : null}
              </p>
              <p>
                Deposit amount is fixed at{' '}
                <span className="font-semibold text-stone-700 dark:text-white/75">
                  {formatCurrency(displayAmount)}
                </span>{' '}
                (founder rule — you cannot pay more or less).
                {displayFreq ? ` · ${formatFrequencyLabel(displayFreq)} schedule` : ''}
              </p>
              {snap.canDepositNow === false && snap.canDepositReason === 'too_early_for_frequency' && (
                <p className="text-amber-700 dark:text-amber-400">
                  Next contribution window opens after your founder{' '}
                  {formatFrequencyLabel(displayFreq).toLowerCase()} period
                  {snap.nextContributionAt
                    ? ` (from ${new Date(snap.nextContributionAt * 1000).toLocaleString()})`
                    : ''}
                  .
                </p>
              )}
            </div>
          )}

          {/* Circle wallet ≠ forge deploy key — explain + one-click fix */}
          {isConnected && snap && !snap.isMember && (
            <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-500/25 bg-amber-50/80 dark:bg-amber-500/10 px-3.5 py-3">
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                Circle wallet not on the vault yet
              </p>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-200/80 mt-1 leading-relaxed">
                {walletVsOrganizerMismatch ? (
                  <>
                    This is expected — not a new-cooperative bug. The vault was deployed with
                    organizer <span className="font-mono">{shortAddr(snap.organizer)}</span>{' '}
                    (your forge/deploy key). You log in with Circle, which is a{' '}
                    <strong>different</strong> address (
                    <span className="font-mono">{shortAddr(walletAddress)}</span>). Only
                    registered addresses can deposit.
                  </>
                ) : (
                  <>
                    Your wallet matches the organizer but is not in the member list yet. Register
                    once to enable deposits.
                  </>
                )}
              </p>
              {isCircleEmailWallet && (
                <p className="text-[11px] text-amber-800/80 dark:text-amber-200/70 mt-1.5 leading-relaxed">
                  Tap <strong>Register my Circle wallet</strong> below. The server uses the deploy
                  key to register you (and hand over organizer) so you can deposit and manage
                  members from this account.
                </p>
              )}
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={
            !isConnected ||
            busy !== null ||
            snap?.contributionStatus === 'paid' ||
            snap?.canDepositNow === false ||
            (snap != null && !snap.isMember)
          }
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

        {isConnected && snap && !snap.isMember && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void onRegisterSelf()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50"
          >
            {busy === 'register' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Users className="w-4 h-4" />
            )}
            Register my Circle wallet
          </button>
        )}
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

      <p className="mt-3 text-[11px] text-stone-400 dark:text-white/35 leading-relaxed">
        One deposit path: the founder amount is pulled on-chain (approve USDC → vault deposit) and
        the app ledger updates automatically for members, charts, and notifications. Schedule is
        enforced on-chain (weekly = 7d, bi-weekly = 14d, monthly = 30d). Min $
        {MIN_CONTRIBUTION_USDC}. This app never holds your private key.
      </p>
    </motion.div>
  );
}

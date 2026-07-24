/**
 * On-chain CooperativeTreasuryVault panel — Arc Testnet.
 * Requires VITE_TREASURY_VAULT_ADDRESS after forge deploy.
 */

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownLeft,
  ExternalLink,
  Loader2,
  RefreshCw,
  Shield,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { useWallet } from '@/providers/WalletProvider';
import { formatCurrency } from '@/utils/format';
import { ARC_EXPLORER_URL, ARC_FAUCET_URL } from '@/config/arc';
import { TREASURY_VAULT_ADDRESS } from '@/config/treasury-vault';
import {
  depositToVault,
  fetchVaultSnapshot,
  isVaultConfigured,
  registerMemberOnVault,
  triggerVaultPayout,
  type VaultSnapshot,
} from '@/services/treasury/vault';
import { cn } from '@/lib/utils';

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

export function OnChainVaultPanel() {
  const { walletAddress, isConnected, isCircleEmailWallet } = useWallet();
  const configured = isVaultConfigured();
  const [snap, setSnap] = useState<VaultSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'deposit' | 'payout' | 'register' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!configured) {
      setSnap(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVaultSnapshot(walletAddress);
      setSnap(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load vault');
    } finally {
      setLoading(false);
    }
  }, [configured, walletAddress]);

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
      // Brief delay so RPC can index
      await new Promise((r) => setTimeout(r, 2500));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'On-chain deposit failed');
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
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payout failed');
    } finally {
      setBusy(null);
    }
  };

  const onRegisterSelf = async () => {
    if (!walletAddress) {
      setError('Connect your wallet first');
      return;
    }
    setBusy('register');
    setError(null);
    setSuccess(null);
    try {
      await registerMemberOnVault(walletAddress as `0x${string}`);
      setSuccess('Member registration submitted (organizer only). Complete wallet / PIN prompt.');
      await new Promise((r) => setTimeout(r, 2500));
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Registration failed — only the vault organizer can register members.',
      );
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
              Deploy <code className="text-[11px] font-mono">CooperativeTreasuryVault</code> to Arc
              Testnet, then set{' '}
              <code className="text-[11px] font-mono">VITE_TREASURY_VAULT_ADDRESS</code> and rebuild.
            </p>
            <pre className="mt-3 text-[11px] font-mono bg-stone-50 dark:bg-[#2E3B4B]/40 border border-stone-100 dark:border-white/8 rounded-xl p-3 overflow-x-auto text-stone-600 dark:text-white/55">
{`cd contracts
forge script script/Deploy.s.sol:Deploy \\
  --rpc-url https://rpc.testnet.arc.network \\
  --broadcast --legacy`}
            </pre>
            <a
              href={`${ARC_FAUCET_URL}`}
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5 mb-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-stone-800 dark:text-white">
              On-chain Treasury Vault
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
              Arc
            </span>
          </div>
          <p className="text-xs text-stone-400 dark:text-white/40 mt-0.5">
            USDC contributions · rotation payouts · allocation buckets
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

      {snap && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="rounded-xl bg-stone-50 dark:bg-[#2E3B4B]/35 border border-stone-100 dark:border-white/6 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-white/35">
                On-chain balance
              </p>
              <p className="text-base font-display font-bold text-stone-800 dark:text-white mt-0.5">
                {formatCurrency(snap.totalBalance)}
              </p>
            </div>
            <div className="rounded-xl bg-stone-50 dark:bg-[#2E3B4B]/35 border border-stone-100 dark:border-white/6 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-white/35">
                Cycle contribution
              </p>
              <p className="text-base font-display font-bold text-stone-800 dark:text-white mt-0.5">
                {formatCurrency(snap.contributionAmount)}
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
            <p className="text-xs text-stone-500 dark:text-white/45 mb-3">
              Your status:{' '}
              <span className="font-semibold text-stone-700 dark:text-white/75">
                {snap.isMember
                  ? `${statusLabel(snap.contributionStatus)}${
                      snap.joinPosition ? ` · position #${snap.joinPosition}` : ''
                    }`
                  : 'Not registered on vault'}
              </span>
            </p>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!isConnected || busy !== null || (snap?.contributionStatus === 'paid')}
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
          Contribute on-chain
          {snap ? ` (${formatCurrency(snap.contributionAmount)})` : ''}
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
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-stone-200 dark:border-white/15 text-stone-700 dark:text-white/80 hover:bg-stone-50 dark:hover:bg-white/5 disabled:opacity-50"
          >
            {busy === 'register' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Users className="w-4 h-4" />
            )}
            Register me (organizer)
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{success}</p>}

      <p className="mt-3 text-[11px] text-stone-400 dark:text-white/35 leading-relaxed">
        On-chain deposit uses the vault&apos;s fixed contribution amount (approve USDC → deposit).
        Ledger deposit above remains for off-chain bookkeeping. You deploy the contract yourself —
        this app never holds your private key.
      </p>
    </motion.div>
  );
}

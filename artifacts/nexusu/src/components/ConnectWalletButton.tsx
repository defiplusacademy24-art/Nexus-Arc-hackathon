/**
 * Polaris-style Circle login modal — email only.
 * Uses Nexusu brand palette and follows the app light/dark theme.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'wouter';
import {
  Mail,
  X,
  ArrowLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useWallet } from '@/providers/WalletProvider';
import { NexusuLogo } from '@/components/NexusuLogo';

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function ConnectWalletButton() {
  const wallet = useWallet();
  const [, navigate] = useLocation();
  const [view, setView] = useState<'options' | 'email'>('options');
  const [email, setEmail] = useState(wallet.lastUcEmail ?? '');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const error = localError ?? wallet.error;
  const isBusy = busy || wallet.isConnecting;

  const close = () => navigate('/');

  const goEmail = async () => {
    const trimmed = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setLocalError('Enter a valid email address');
      return;
    }
    if (!wallet.circleEmailEnabled) {
      setLocalError(
        'Circle email login is not configured. Set VITE_CIRCLE_UC_APP_ID and CIRCLE_UC_API_KEY.',
      );
      return;
    }
    setLocalError(null);
    setBusy(true);
    try {
      await wallet.connectWithEmail(trimmed);
      // Soft hand-off: leave OTP/PIN UI, then route. Parent /app also redirects.
      navigate('/dashboard', { replace: true });
    } catch {
      // error on wallet state
    } finally {
      setBusy(false);
    }
  };

  const headings = {
    options: {
      title: 'Log in to Nexusu',
      sub: 'Connect a wallet to manage cooperatives and settle in USDC.',
    },
    email: {
      title: 'Continue with email',
      sub: "We'll send a one-time code to verify it's you.",
    },
  } as const;

  const modal = (
    <div
      className={cn(
        'fixed inset-0 z-[1000] flex items-center justify-center p-4 backdrop-blur-md transition-opacity duration-200',
        'bg-stone-900/40 dark:bg-black/70',
        mounted ? 'opacity-100' : 'opacity-0',
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="nexusu-login-title"
    >
      {/* Soft brand glow */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute left-1/2 top-[38%] h-44 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6393C4]/20 blur-[90px] dark:bg-[#6393C4]/25" />
      </div>

      <div
        className={cn(
          'relative w-full max-w-[400px] overflow-hidden rounded-2xl border transition-all duration-200',
          'border-stone-200 bg-white shadow-[0_24px_80px_rgba(3,15,31,0.14)]',
          'dark:border-[#1A2A3A] dark:bg-[#081827] dark:shadow-[0_24px_80px_rgba(0,0,0,0.55)]',
          mounted ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-[0.98] opacity-0',
        )}
      >
        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 dark:text-white/40 dark:hover:bg-white/5 dark:hover:text-white"
          aria-label="Close"
        >
          <X size={17} />
        </button>

        {/* Brand header */}
        <div className="flex flex-col items-center px-7 pb-2 pt-9 text-center">
          <NexusuMark />
          <h3
            id="nexusu-login-title"
            className="mt-4 font-display text-xl font-semibold tracking-tight text-[#030F1F] dark:text-white"
          >
            {headings[view].title}
          </h3>
          <p className="mt-1.5 max-w-[280px] text-sm leading-relaxed text-stone-500 dark:text-white/50">
            {headings[view].sub}
          </p>
        </div>

        <div className="px-7 pb-7 pt-5">
          {!wallet.circleEmailEnabled ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/5 dark:text-amber-100/80">
              Email login needs{' '}
              <span className="font-mono">VITE_CIRCLE_UC_APP_ID</span> and the API key{' '}
              <span className="font-mono">CIRCLE_UC_API_KEY</span>, then restart.
            </div>
          ) : view === 'options' ? (
            <div className="flex flex-col gap-2.5">
              <MethodButton
                icon={<Mail size={18} strokeWidth={1.75} />}
                title="Email"
                desc="One-time code to your inbox. Gasless, no seed phrase."
                disabled={isBusy}
                onClick={() => {
                  setLocalError(null);
                  setView('email');
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <input
                autoFocus
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                disabled={isBusy}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setLocalError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void goEmail();
                }}
                className={cn(
                  'w-full rounded-xl border px-4 py-3.5 text-sm outline-none transition-colors',
                  'border-stone-200 bg-stone-50 text-[#030F1F] placeholder:text-stone-400',
                  'focus:border-[#6393C4] focus:ring-2 focus:ring-[#6393C4]/25',
                  'dark:border-[#1A2A3A] dark:bg-[#030F1F]/80 dark:text-white dark:placeholder:text-white/30',
                  'dark:focus:border-[#6393C4]/60 dark:focus:ring-[#6393C4]/30',
                )}
              />
              <button
                type="button"
                onClick={() => void goEmail()}
                disabled={isBusy || !email.trim()}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold text-white transition-colors',
                  'bg-[#6393C4] hover:bg-[#5289B8]',
                  'shadow-[0_4px_20px_rgba(99,147,196,0.28)]',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6393C4] focus-visible:ring-offset-2',
                  'dark:focus-visible:ring-offset-[#081827]',
                )}
              >
                {isBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Check your email &amp; follow the steps…
                  </>
                ) : (
                  'Continue'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalError(null);
                  setView('options');
                }}
                disabled={isBusy}
                className="inline-flex items-center justify-center gap-1.5 font-mono text-xs text-stone-400 hover:text-stone-600 dark:text-white/40 dark:hover:text-white/70"
              >
                <ArrowLeft size={13} /> All options
              </button>
            </div>
          )}

          {error && (
            <div
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-500/25 dark:bg-red-500/10"
              role="alert"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500 dark:text-red-400"
                aria-hidden="true"
              />
              <p className="text-xs leading-relaxed text-red-600 dark:text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Footer trust line */}
        <div className="border-t border-stone-100 bg-stone-50/80 px-7 py-3.5 text-center dark:border-[#1A2A3A] dark:bg-[#030F1F]/40">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-stone-400 dark:text-white/35">
            Gasless on Arc · secured by Circle
          </span>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}

function NexusuMark() {
  return <NexusuLogo size="lg" />;
}

function MethodButton({
  icon,
  title,
  desc,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl border px-3.5 py-3.5 text-left transition-colors',
        'border-stone-200 bg-stone-50 hover:border-stone-300 hover:bg-stone-100',
        'dark:border-[#1A2A3A] dark:bg-[#030F1F]/70 dark:hover:border-[#2E3B4B] dark:hover:bg-[#0c1a2b]',
        'disabled:cursor-not-allowed disabled:opacity-60',
      )}
    >
      <span
        className={cn(
          'grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg border',
          'border-stone-200 bg-white text-[#6393C4]',
          'dark:border-[#1A2A3A] dark:bg-[#081827] dark:text-[#77A6DB]',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[#030F1F] dark:text-white">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-xs leading-snug text-stone-500 dark:text-white/40">
          {desc}
        </span>
      </span>
      <ChevronRight
        size={16}
        className="flex-shrink-0 text-stone-300 transition-colors group-hover:text-stone-500 dark:text-white/25 dark:group-hover:text-white/50"
        aria-hidden="true"
      />
    </button>
  );
}

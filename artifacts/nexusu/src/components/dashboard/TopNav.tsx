import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Menu, Bell, Sun, Moon, ShieldCheck, Copy, Check, Wallet } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useWallet } from '@/providers/WalletProvider';
import { useNotifications } from '@/hooks/useNotifications';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { truncateWallet } from '@/utils/format';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Overview',
  '/dashboard/cooperatives': 'Cooperatives',
  '/dashboard/members': 'Members',
  '/dashboard/treasury': 'Treasury',
  '/dashboard/savings': 'Savings',
  '/dashboard/loans': 'Loans',
  '/dashboard/nexa': 'Nexa AI',
  '/dashboard/agents': 'AI Agents',
  '/dashboard/governance': 'Governance',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/notifications': 'Notifications',
  '/dashboard/settings': 'Settings',
  '/dashboard/wallet': 'Wallet',
  '/dashboard/profile': 'Profile',
};

interface TopNavProps {
  onMenuClick: () => void;
}

export function TopNav({ onMenuClick }: TopNavProps) {
  const [location] = useLocation();
  const { resolvedTheme, setTheme } = useTheme();
  const { identity, walletAddress } = useWallet();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const title = PAGE_TITLES[location] ?? 'Dashboard';
  const { unreadCount } = useNotifications();

  const label = identity?.nametag
    ? `@${identity.nametag}`
    : truncateWallet(walletAddress ?? '', 4, 4);

  const copyWallet = async () => {
    if (!walletAddress) {
      toast({
        title: 'No wallet connected',
        variant: 'destructive',
        duration: 2000,
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      toast({
        title: 'Wallet address copied',
        description: truncateWallet(walletAddress, 6, 4),
        duration: 2200,
      });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Could not copy address', variant: 'destructive' });
    }
  };

  return (
    <header className="h-14 border-b border-stone-100 dark:border-[#1A2A3A] bg-white dark:bg-[#081827] flex items-center px-4 gap-3 sticky top-0 z-30 flex-shrink-0">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-xl text-stone-400 dark:text-white/40 hover:bg-stone-100 dark:hover:bg-[#2E3B4B]/60 transition-colors flex-shrink-0"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Page title */}
      <h1 className="text-sm font-semibold text-stone-900 dark:text-white flex-1 min-w-0 truncate lg:hidden">
        {title}
      </h1>

      {/* Desktop: page context */}
      <div className="hidden lg:flex flex-1 items-center min-w-0">
        <h1 className="text-sm font-semibold text-stone-900 dark:text-white truncate">
          {title}
        </h1>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-xl text-stone-400 dark:text-white/40 hover:bg-stone-100 dark:hover:bg-[#2E3B4B]/60 transition-colors"
          aria-label="Toggle theme"
        >
          {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications */}
        <Link
          href="/dashboard/notifications"
          className="relative p-2 rounded-xl text-stone-400 dark:text-white/40 hover:bg-stone-100 dark:hover:bg-[#2E3B4B]/60 transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#6393C4]" />
          )}
        </Link>

        {/*
          Wallet chip (overview top-right):
          - Click copies the full address
          - Nested link opens the wallet page
        */}
        <div
          className={cn(
            'hidden sm:flex items-center gap-0.5 rounded-xl border text-xs font-semibold overflow-hidden',
            'bg-emerald-50 dark:bg-emerald-500/8 border-emerald-200 dark:border-emerald-500/20',
            'text-emerald-700 dark:text-emerald-400',
          )}
        >
          <button
            type="button"
            onClick={copyWallet}
            title={walletAddress ? `Copy ${walletAddress}` : 'No wallet'}
            aria-label="Copy wallet address"
            className="flex items-center gap-2 pl-3 pr-2 py-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden md:inline max-w-[7.5rem] truncate">{label || 'Wallet'}</span>
            <span className="md:hidden">Wallet</span>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />
            ) : (
              <Copy className="w-3.5 h-3.5 opacity-70" />
            )}
          </button>
          <Link
            href="/dashboard/wallet"
            title="Open wallet"
            aria-label="Open wallet page"
            className="px-2 py-1.5 border-l border-emerald-200/80 dark:border-emerald-500/25 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 transition-colors"
          >
            <Wallet className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Avatar → Profile */}
        <Link
          href="/dashboard/profile"
          className="flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity ring-2 ring-transparent hover:ring-[#6393C4]/30 rounded-full"
          aria-label="Open profile"
        >
          <UserAvatar
            displayName={identity?.displayName ?? 'ME'}
            size="md"
            rounded="full"
          />
        </Link>
      </div>
    </header>
  );
}

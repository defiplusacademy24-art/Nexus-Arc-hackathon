import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Menu, Bell, Sun, Moon, Copy, Check, Wallet } from 'lucide-react';
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
      toast({ title: 'No wallet connected', variant: 'destructive', duration: 2000 });
      return;
    }
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      toast({
        title: 'Address copied',
        description: truncateWallet(walletAddress, 6, 4),
        duration: 2000,
      });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: 'Could not copy', variant: 'destructive' });
    }
  };

  return (
    <header className="h-14 border-b border-stone-200/70 dark:border-white/[0.06] bg-white/80 dark:bg-[#0A1522]/85 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-[#0A1522]/75 flex items-center px-3 sm:px-5 gap-2 sticky top-0 z-30 flex-shrink-0">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-xl text-stone-500 dark:text-white/45 hover:bg-stone-100/80 dark:hover:bg-white/[0.06] transition-colors flex-shrink-0"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <h1 className="text-[13px] font-semibold tracking-tight text-stone-900 dark:text-white flex-1 min-w-0 truncate lg:hidden">
        {title}
      </h1>

      <div className="hidden lg:flex flex-1 items-center min-w-0">
        <h1 className="text-[13px] font-semibold tracking-tight text-stone-800 dark:text-white/90 truncate">
          {title}
        </h1>
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-xl text-stone-500 dark:text-white/40 hover:bg-stone-100/80 dark:hover:bg-white/[0.06] transition-colors"
          aria-label="Toggle theme"
        >
          {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <Link
          href="/dashboard/notifications"
          className="relative p-2 rounded-xl text-stone-500 dark:text-white/40 hover:bg-stone-100/80 dark:hover:bg-white/[0.06] transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#6393C4] ring-2 ring-white dark:ring-[#0A1522]" />
          )}
        </Link>

        <div
          className={cn(
            'hidden sm:flex items-center rounded-full border overflow-hidden',
            'bg-stone-50/90 dark:bg-white/[0.04] border-stone-200/80 dark:border-white/[0.08]',
            'text-stone-700 dark:text-white/80 text-[11px] font-semibold tracking-tight',
          )}
        >
          <button
            type="button"
            onClick={copyWallet}
            title={walletAddress ? `Copy ${walletAddress}` : 'No wallet'}
            aria-label="Copy wallet address"
            className="flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 hover:bg-stone-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]" />
            <span className="hidden md:inline max-w-[6.5rem] truncate font-mono text-[11px]">
              {label || 'Wallet'}
            </span>
            <span className="md:hidden font-mono">{label ? truncateWallet(walletAddress ?? '', 3, 3) : '…'}</span>
            {copied ? (
              <Check className="w-3 h-3 text-emerald-500" />
            ) : (
              <Copy className="w-3 h-3 opacity-50" />
            )}
          </button>
          <Link
            href="/dashboard/wallet"
            title="Open wallet"
            aria-label="Open wallet page"
            className="px-2 py-1.5 border-l border-stone-200/80 dark:border-white/[0.08] hover:bg-stone-100 dark:hover:bg-white/[0.06] transition-colors text-stone-500 dark:text-white/50"
          >
            <Wallet className="w-3.5 h-3.5" />
          </Link>
        </div>

        <Link
          href="/dashboard/profile"
          className="flex-shrink-0 ml-0.5 rounded-full ring-2 ring-transparent hover:ring-[#6393C4]/25 transition-all"
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

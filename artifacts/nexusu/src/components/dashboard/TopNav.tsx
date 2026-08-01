import { useLocation, Link } from 'wouter';
import { Menu, Bell, Sun, Moon, ShieldCheck } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useWallet } from '@/providers/WalletProvider';
import { useNotifications } from '@/hooks/useNotifications';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { truncateWallet } from '@/utils/format';

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

  const title = PAGE_TITLES[location] ?? 'Dashboard';
  const { unreadCount } = useNotifications();

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

      {/* Desktop: page context (search ships when global index is ready) */}
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

        {/* Wallet indicator */}
        <Link
          href="/dashboard/wallet"
          className="hidden sm:flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/8 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-500/12 transition-colors"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="hidden md:inline">
            {identity?.nametag ? `@${identity.nametag}` : truncateWallet(walletAddress ?? '', 4, 4)}
          </span>
          <span className="md:hidden">Verified</span>
        </Link>

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

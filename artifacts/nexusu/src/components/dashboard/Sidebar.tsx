import { useState, type ElementType, lazy, Suspense } from 'react';
import { useLocation, Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Building2, Users, Vault, PiggyBank,
  Banknote, Sparkles, Scale, BarChart3, Bell, Settings,
  X, LogOut, UserCircle, Bot, Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWallet } from '@/providers/WalletProvider';
import { useNotifications } from '@/hooks/useNotifications';
import { NexusuLogo } from '@/components/NexusuLogo';
import { WorkspaceSwitcher } from '@/components/cooperative/WorkspaceSwitcher';
import { UserAvatar } from '@/components/profile/UserAvatar';

// Lazy-load heavy modals (QR / wizard) so a bad import cannot crash the whole dashboard shell.
const CreateWizard = lazy(() =>
  import('@/components/cooperative/CreateWizard').then((m) => ({ default: m.CreateWizard })),
);
const JoinModal = lazy(() =>
  import('@/components/cooperative/JoinModal').then((m) => ({ default: m.JoinModal })),
);

interface NavItem {
  label: string;
  href: string;
  icon: ElementType;
  badge?: string | number;
  section?: string;
}

const BASE_NAV_ITEMS: Omit<NavItem, 'badge'>[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Cooperatives', href: '/dashboard/cooperatives', icon: Building2, section: 'Organisation' },
  { label: 'Members', href: '/dashboard/members', icon: Users },
  { label: 'Treasury', href: '/dashboard/treasury', icon: Vault, section: 'Finance' },
  { label: 'Savings', href: '/dashboard/savings', icon: PiggyBank },
  { label: 'Loans', href: '/dashboard/loans', icon: Banknote },
  { label: 'AI Agents', href: '/dashboard/agents', icon: Bot, section: 'Intelligence' },
  { label: 'Nexa AI', href: '/dashboard/nexa', icon: Sparkles },
  { label: 'Governance', href: '/dashboard/governance', icon: Scale },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { label: 'Notifications', href: '/dashboard/notifications', icon: Bell, section: 'Account' },
  { label: 'Wallet', href: '/dashboard/wallet', icon: Wallet },
  { label: 'Profile', href: '/dashboard/profile', icon: UserCircle },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  mobile?: boolean;
}

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 group relative',
        active
          ? 'bg-[#6393C4]/12 dark:bg-[#6393C4]/15 text-[#3D6F9E] dark:text-[#9EC0E0] shadow-[inset_3px_0_0_0_#6393C4]'
          : 'text-stone-500 dark:text-white/45 hover:text-stone-900 dark:hover:text-white/90 hover:bg-stone-100/80 dark:hover:bg-white/[0.04]',
      )}
    >
      <item.icon
        className={cn(
          'w-4 h-4 flex-shrink-0 transition-colors',
          active
            ? 'text-[#6393C4]'
            : 'text-stone-400 dark:text-white/30 group-hover:text-stone-600 dark:group-hover:text-white/60',
        )}
      />
      <span className="flex-1 truncate tracking-tight">{item.label}</span>
      {item.badge != null && item.badge !== '' && (
        <span
          className={cn(
            'flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md min-w-[1.25rem] text-center tabular-nums',
            active
              ? 'bg-[#6393C4]/20 text-[#3D6F9E] dark:text-[#9EC0E0]'
              : 'bg-stone-100 dark:bg-white/[0.06] text-stone-500 dark:text-white/50',
          )}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ open, onClose, mobile = false }: SidebarProps) {
  const [location] = useLocation();
  const { identity, disconnect } = useWallet();
  const { unreadCount } = useNotifications();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const isActive = (href: string) =>
    href === '/dashboard' ? location === '/dashboard' : location.startsWith(href);

  const handleDisconnect = async () => {
    await disconnect();
    window.location.href = '/';
  };

  const navItems: NavItem[] = BASE_NAV_ITEMS.map((item) =>
    item.href === '/dashboard/notifications' && unreadCount > 0
      ? { ...item, badge: unreadCount }
      : { ...item },
  );

  let lastSection = '';

  const content = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 h-14 border-b border-stone-200/70 dark:border-white/[0.06]">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={mobile ? onClose : undefined}>
          <NexusuLogo size="md" decorative={false} />
          <span className="font-display font-semibold text-[15px] text-stone-900 dark:text-white tracking-tight">
            Nexusu
          </span>
        </Link>
        {mobile && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 dark:text-white/40 hover:bg-stone-100 dark:hover:bg-white/[0.06]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="px-3 py-3 border-b border-stone-200/70 dark:border-white/[0.06]">
        <WorkspaceSwitcher
          onCreateRequest={() => setShowCreate(true)}
          onJoinRequest={() => setShowJoin(true)}
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
        {navItems.map((item) => {
          const showSection = item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;
          return (
            <div key={item.href}>
              {showSection && (
                <p className="px-2.5 pt-4 pb-1.5 text-[10px] font-semibold text-stone-400/90 dark:text-white/25 uppercase tracking-[0.08em]">
                  {item.section}
                </p>
              )}
              <NavLink item={item} active={isActive(item.href)} onClick={mobile ? onClose : undefined} />
            </div>
          );
        })}
      </nav>

      <div className="px-2.5 pb-3 pt-2 border-t border-stone-200/70 dark:border-white/[0.06] space-y-0.5">
        <Link
          href="/dashboard/profile"
          onClick={mobile ? onClose : undefined}
          className={cn(
            'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all',
            isActive('/dashboard/profile')
              ? 'bg-[#6393C4]/12 dark:bg-[#6393C4]/15'
              : 'hover:bg-stone-100/80 dark:hover:bg-white/[0.04]',
          )}
        >
          <UserAvatar
            displayName={identity?.displayName ?? 'My Wallet'}
            size="sm"
            rounded="full"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate text-stone-800 dark:text-white tracking-tight">
              {identity?.displayName ?? 'My Wallet'}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <p className="text-[10px] text-stone-400 dark:text-white/35 truncate">Arc Testnet</p>
            </div>
          </div>
        </Link>

        <button
          onClick={handleDisconnect}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-stone-400 dark:text-white/35 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-500/[0.08] transition-all"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>Sign out</span>
        </button>
      </div>

      {/* Cooperative modals (lazy — only load when opened) */}
      <AnimatePresence>
        {showCreate && (
          <Suspense fallback={null}>
            <CreateWizard onClose={() => setShowCreate(false)} />
          </Suspense>
        )}
        {showJoin && (
          <Suspense fallback={null}>
            <JoinModal onClose={() => setShowJoin(false)} />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );

  if (!mobile) {
    return (
      <aside className="hidden lg:flex flex-col w-[15.5rem] flex-shrink-0 bg-white/90 dark:bg-[#0A1522]/95 border-r border-stone-200/70 dark:border-white/[0.06] h-screen sticky top-0 backdrop-blur-sm">
        {content}
      </aside>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-[#0A1522] border-r border-stone-200/70 dark:border-white/[0.06] lg:hidden shadow-2xl"
          >
            {content}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

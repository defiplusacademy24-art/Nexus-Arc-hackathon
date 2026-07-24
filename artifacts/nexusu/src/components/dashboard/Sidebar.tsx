import { useState, type ElementType, lazy, Suspense } from 'react';
import { useLocation, Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Building2, Users, Vault, PiggyBank,
  Banknote, Sparkles, Scale, BarChart3, Bell, Settings,
  X, LogOut, UserCircle,
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
  { label: 'Nexa AI', href: '/dashboard/nexa', icon: Sparkles, section: 'Intelligence' },
  { label: 'Governance', href: '/dashboard/governance', icon: Scale },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { label: 'Notifications', href: '/dashboard/notifications', icon: Bell, section: 'Account' },
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
        'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 group relative',
        active
          ? 'bg-[#6393C4] text-white shadow-[0_2px_12px_rgba(99,147,196,0.30)]'
          : 'text-stone-400 dark:text-[#707B89] hover:text-stone-900 dark:hover:text-[#EEE6E6] hover:bg-stone-100 dark:hover:bg-[#2E3B4B]/60',
      )}
    >
      <item.icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-white' : 'text-stone-400 dark:text-white/40 group-hover:text-stone-600 dark:group-hover:text-white/70')} />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && (
        <span className={cn(
          'flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
          active ? 'bg-white/25 text-white' : 'bg-[#6393C4]/12 text-[#6393C4]',
        )}>
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
      {/* Logo + close */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-stone-100 dark:border-[#1A2A3A]">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={mobile ? onClose : undefined}>
          <NexusuLogo size="md" decorative={false} />
          <span className="font-display font-bold text-base text-stone-900 dark:text-white tracking-tight">Nexusu</span>
        </Link>
        {mobile && (
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 dark:text-white/40 hover:bg-stone-100 dark:hover:bg-white/8">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Cooperative workspace switcher */}
      <div className="px-4 py-3 border-b border-stone-100 dark:border-[#1A2A3A]">
        <WorkspaceSwitcher
          onCreateRequest={() => setShowCreate(true)}
          onJoinRequest={() => setShowJoin(true)}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5 scrollbar-thin">
        {navItems.map((item) => {
          const showSection = item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;
          return (
            <div key={item.href}>
              {showSection && (
                <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold text-stone-400 dark:text-white/25 uppercase tracking-widest">
                  {item.section}
                </p>
              )}
              <NavLink item={item} active={isActive(item.href)} onClick={mobile ? onClose : undefined} />
            </div>
          );
        })}
      </nav>

      {/* User profile */}
      <div className="px-3 pb-4 pt-2 border-t border-stone-100 dark:border-[#1A2A3A] space-y-1">
        <Link
          href="/dashboard/profile"
          onClick={mobile ? onClose : undefined}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all hover:bg-stone-100 dark:hover:bg-[#2E3B4B]/60',
            isActive('/dashboard/profile') ? 'bg-[#6393C4] text-white' : 'text-stone-500 dark:text-white/50',
          )}
        >
          <UserAvatar
            displayName={identity?.displayName ?? 'My Wallet'}
            size="sm"
            rounded="full"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate text-stone-800 dark:text-white">{identity?.displayName ?? 'My Wallet'}</p>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              <p className="text-[10px] text-emerald-500 truncate">Arc Testnet</p>
            </div>
          </div>
        </Link>

        <button
          onClick={handleDisconnect}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-stone-400 dark:text-white/30 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/8 transition-all"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>Disconnect</span>
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
      <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 bg-white dark:bg-[#081827] border-r border-stone-100 dark:border-[#1A2A3A] h-screen sticky top-0">
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
            className="fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-[#081827] border-r border-stone-100 dark:border-[#1A2A3A] lg:hidden"
          >
            {content}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Building2, Users, Vault, PiggyBank,
  Banknote, Sparkles, Scale, BarChart3, Bell, Settings,
  X, Wallet, LogOut, UserCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUnicity } from '@/providers/UnicityProvider';
import { WorkspaceSwitcher } from '@/components/cooperative/WorkspaceSwitcher';
import { CreateWizard } from '@/components/cooperative/CreateWizard';
import { JoinModal } from '@/components/cooperative/JoinModal';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string | number;
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Cooperatives', href: '/dashboard/cooperatives', icon: Building2, section: 'Organisation' },
  { label: 'Members', href: '/dashboard/members', icon: Users },
  { label: 'Treasury', href: '/dashboard/treasury', icon: Vault, section: 'Finance' },
  { label: 'Savings', href: '/dashboard/savings', icon: PiggyBank },
  { label: 'Loans', href: '/dashboard/loans', icon: Banknote, badge: 2 },
  { label: 'Nexa AI', href: '/dashboard/nexa', icon: Sparkles, section: 'Intelligence' },
  { label: 'Governance', href: '/dashboard/governance', icon: Scale, badge: 2 },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { label: 'Notifications', href: '/dashboard/notifications', icon: Bell, badge: 5, section: 'Account' },
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
          ? 'bg-[#E8461E] text-white shadow-[0_2px_12px_rgba(232,70,30,0.30)]'
          : 'text-stone-400 dark:text-white/50 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-white/6',
      )}
    >
      <item.icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-white' : 'text-stone-400 dark:text-white/40 group-hover:text-stone-600 dark:group-hover:text-white/70')} />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && (
        <span className={cn(
          'flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
          active ? 'bg-white/25 text-white' : 'bg-[#E8461E]/12 text-[#E8461E]',
        )}>
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ open, onClose, mobile = false }: SidebarProps) {
  const [location] = useLocation();
  const { identity, disconnect } = useUnicity();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const isActive = (href: string) =>
    href === '/dashboard' ? location === '/dashboard' : location.startsWith(href);

  const handleDisconnect = async () => {
    await disconnect();
    window.location.href = '/';
  };

  let lastSection = '';

  const content = (
    <div className="flex flex-col h-full">
      {/* Logo + close */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-stone-100 dark:border-white/6">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={mobile ? onClose : undefined}>
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-white flex-shrink-0 shadow-sm border border-orange-100 dark:border-white/10">
            <img src="/logo.png" alt="Nexusu" className="w-full h-full object-contain" />
          </div>
          <span className="font-display font-bold text-base text-stone-900 dark:text-white tracking-tight">Nexusu</span>
        </Link>
        {mobile && (
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 dark:text-white/40 hover:bg-stone-100 dark:hover:bg-white/8">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Cooperative workspace switcher */}
      <div className="px-4 py-3 border-b border-stone-100 dark:border-white/6">
        <WorkspaceSwitcher
          onCreateRequest={() => setShowCreate(true)}
          onJoinRequest={() => setShowJoin(true)}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5 scrollbar-thin">
        {NAV_ITEMS.map((item) => {
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
      <div className="px-3 pb-4 pt-2 border-t border-stone-100 dark:border-white/6 space-y-1">
        <Link
          href="/dashboard/profile"
          onClick={mobile ? onClose : undefined}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all hover:bg-stone-100 dark:hover:bg-white/6',
            isActive('/dashboard/profile') ? 'bg-[#E8461E] text-white' : 'text-stone-500 dark:text-white/50',
          )}
        >
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#E8461E] to-[#F97316] flex items-center justify-center flex-shrink-0">
            <Wallet className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate text-stone-800 dark:text-white">{identity?.displayName ?? 'My Wallet'}</p>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              <p className="text-[10px] text-emerald-500 truncate">Verified by Unicity</p>
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

      {/* Cooperative modals (rendered inside sidebar so they overlay the full page) */}
      <AnimatePresence>
        {showCreate && <CreateWizard onClose={() => setShowCreate(false)} />}
        {showJoin && <JoinModal onClose={() => setShowJoin(false)} />}
      </AnimatePresence>
    </div>
  );

  if (!mobile) {
    return (
      <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 bg-white dark:bg-stone-950 border-r border-stone-100 dark:border-white/6 h-screen sticky top-0">
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
            className="fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-stone-950 border-r border-stone-100 dark:border-white/6 lg:hidden"
          >
            {content}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

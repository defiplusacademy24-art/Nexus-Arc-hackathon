import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard, Users, Vault,
  Banknote, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const MOBILE_NAV = [
  { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Treasury', href: '/dashboard/treasury', icon: Vault },
  { label: 'Loans', href: '/dashboard/loans', icon: Banknote },
  { label: 'Nexa', href: '/dashboard/nexa', icon: Sparkles },
  { label: 'More', href: '/dashboard/members', icon: Users },
];

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();

  const mobileIsActive = (href: string) =>
    href === '/dashboard' ? location === '/dashboard' : location.startsWith(href);

  return (
    <div className="flex h-screen bg-[#F4F6F9] dark:bg-[#050D18] overflow-hidden">
      <Sidebar open={false} onClose={() => {}} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} mobile />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-[calc(5.25rem+env(safe-area-inset-bottom))] lg:pb-10">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>

        {/* Mobile tab bar — app-store style */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-stone-200/80 dark:border-white/[0.06] bg-white/90 dark:bg-[#0A1522]/92 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75 dark:supports-[backdrop-filter]:bg-[#0A1522]/80 flex pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(15,23,42,0.04)]">
          {MOBILE_NAV.map((item) => {
            const active = mobileIsActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors min-w-0',
                  active
                    ? 'text-[#4A7FB0]'
                    : 'text-stone-400 dark:text-white/35',
                )}
              >
                <span
                  className={cn(
                    'flex items-center justify-center w-10 h-7 rounded-full transition-colors',
                    active && 'bg-[#6393C4]/12 dark:bg-[#6393C4]/15',
                  )}
                >
                  <item.icon className={cn('w-[1.15rem] h-[1.15rem]', active && 'text-[#6393C4]')} />
                </span>
                <span className="truncate max-w-full px-0.5">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

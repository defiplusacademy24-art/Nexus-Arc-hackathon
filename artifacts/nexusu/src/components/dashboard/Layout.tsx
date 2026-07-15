import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard, Building2, Users, Vault,
  PiggyBank, Banknote, Sparkles, Scale, BarChart3, Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';

const MOBILE_NAV = [
  { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Treasury', href: '/dashboard/treasury', icon: Vault },
  { label: 'Loans', href: '/dashboard/loans', icon: Banknote },
  { label: 'Nexa', href: '/dashboard/nexa', icon: Sparkles },
  { label: 'More', href: '/dashboard/members', icon: Users },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();

  const mobileIsActive = (href: string) =>
    href === '/dashboard' ? location === '/dashboard' : location.startsWith(href);

  return (
    <div className="flex h-screen bg-[#EEF2F6] dark:bg-[#030F1F] overflow-hidden">
      {/* Desktop sidebar */}
      <Sidebar open={false} onClose={() => {}} />

      {/* Mobile drawer */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} mobile />

      {/* Main column */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav onMenuClick={() => setSidebarOpen(true)} />

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-8">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-[#081827] border-t border-[#1A2A3A]/20 dark:border-[#1A2A3A] flex">
          {MOBILE_NAV.map((item) => {
            const active = mobileIsActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors',
                  active
                    ? 'text-[#6393C4]'
                    : 'text-stone-400 dark:text-white/40 hover:text-stone-600 dark:hover:text-white/60',
                )}
              >
                <item.icon className={cn('w-5 h-5', active && 'text-[#6393C4]')} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

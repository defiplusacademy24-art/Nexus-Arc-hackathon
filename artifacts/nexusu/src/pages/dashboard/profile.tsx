import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { ChevronLeft, UserCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { useWallet } from '@/providers/WalletProvider';
import { useIdentity } from '@/hooks/useIdentity';
import { useWalletAssets } from '@/hooks/useWalletAssets';
import { useProfile } from '@/hooks/useProfile';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { WalletBalanceCard } from '@/components/profile/WalletBalanceCard';
import { MemberCard } from '@/components/profile/MemberCard';
import { MemberStats } from '@/components/profile/MemberStats';
import { PreferencesCard } from '@/components/profile/PreferencesCard';

function NotConnected() {
  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-stone-100 dark:bg-white/6 flex items-center justify-center mb-4">
          <UserCircle className="w-8 h-8 text-stone-300 dark:text-white/20" />
        </div>
        <h2 className="text-lg font-display font-bold text-stone-800 dark:text-white mb-2">
          Not signed in
        </h2>
        <p className="text-sm text-stone-400 dark:text-white/40 mb-6 max-w-xs">
          Sign in to view your profile.
        </p>
        <Link
          href="/app"
          className="px-5 py-2.5 rounded-xl bg-[#6393C4] text-white text-sm font-semibold hover:bg-[#d43e1b] transition-colors"
        >
          Sign in with Email
        </Link>
      </div>
    </DashboardLayout>
  );
}

export default function ProfilePage() {
  const { isConnected } = useWallet();
  const identity = useIdentity();
  const assets = useWalletAssets();
  const profile = useProfile();

  if (!isConnected || !identity) return <NotConnected />;

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 py-6 max-w-5xl mx-auto">

        {/* Page title */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-6"
        >
          <Link
            href="/dashboard"
            className="p-1.5 rounded-lg text-stone-400 dark:text-white/30 hover:text-stone-700 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-[#2E3B4B]/60 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-display font-bold text-stone-900 dark:text-white leading-tight">
              Identity & Profile
            </h1>
            <p className="text-xs text-stone-400 dark:text-white/35 mt-0.5">
              Your Nexusu profile · {identity.network}
            </p>
          </div>
        </motion.div>

        {/* Profile header — photo upload lives here */}
        <ProfileHeader
          identity={identity}
          prefs={profile.prefs}
          onAvatarChange={profile.setAvatarUrl}
          onAvatarClear={profile.clearAvatar}
        />

        {/* 1. Wallet assets first */}
        <div className="mb-5">
          <WalletBalanceCard assets={assets} delay={0.05} />
        </div>

        {/* 2. Cooperative details */}
        <div className="mb-5">
          <MemberCard delay={0.1} />
        </div>

        {/* 3. Member stats */}
        <div className="mb-5">
          <MemberStats delay={0.15} />
        </div>

        {/* 4. Preferences */}
        <PreferencesCard profile={profile} delay={0.2} />

      </div>
    </DashboardLayout>
  );
}

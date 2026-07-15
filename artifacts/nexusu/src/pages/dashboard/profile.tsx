import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { ChevronLeft, UserCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { useWallet } from '@/providers/WalletProvider';
import { useIdentity } from '@/hooks/useIdentity';
import { useWalletAssets } from '@/hooks/useWalletAssets';
import { useProfile } from '@/hooks/useProfile';
import { useSession } from '@/hooks/useSession';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { IdentityCard } from '@/components/profile/IdentityCard';
import { WalletBalanceCard } from '@/components/profile/WalletBalanceCard';
import { MemberCard } from '@/components/profile/MemberCard';
import { MemberStats } from '@/components/profile/MemberStats';
import { ActivityTimeline } from '@/components/profile/ActivityTimeline';
import { SecurityCard } from '@/components/profile/SecurityCard';
import { PreferencesCard } from '@/components/profile/PreferencesCard';

function NotConnected() {
  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-stone-100 dark:bg-white/6 flex items-center justify-center mb-4">
          <UserCircle className="w-8 h-8 text-stone-300 dark:text-white/20" />
        </div>
        <h2 className="text-lg font-display font-bold text-stone-800 dark:text-white mb-2">
          No wallet connected
        </h2>
        <p className="text-sm text-stone-400 dark:text-white/40 mb-6 max-w-xs">
          Connect your wallet on Arc Testnet to view your Nexusu identity and profile.
        </p>
        <Link
          href="/app"
          className="px-5 py-2.5 rounded-xl bg-[#6393C4] text-white text-sm font-semibold hover:bg-[#d43e1b] transition-colors"
        >
          Connect Wallet
        </Link>
      </div>
    </DashboardLayout>
  );
}

export default function ProfilePage() {
  const { isConnected, disconnect, reconnect } = useWallet();
  const identity = useIdentity();
  const assets = useWalletAssets();
  const profile = useProfile();
  const session = useSession();

  if (!isConnected || !identity) return <NotConnected />;

  const handleDisconnect = async () => {
    await disconnect();
    window.location.href = '/';
  };

  const handleReconnect = async () => {
    await reconnect();
  };

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
              Your Nexusu decentralised identity · {identity.network}
            </p>
          </div>
        </motion.div>

        {/* Profile header */}
        <ProfileHeader identity={identity} prefs={profile.prefs} />

        {/* Row 1: Identity + Membership */}
        <div className="grid lg:grid-cols-2 gap-5 mb-5">
          <IdentityCard identity={identity} delay={0.05} />
          <MemberCard delay={0.1} />
        </div>

        {/* Row 2: Wallet assets — full width */}
        <div className="mb-5">
          <WalletBalanceCard assets={assets} delay={0.15} />
        </div>

        {/* Row 3: Stats + Activity */}
        <div className="grid lg:grid-cols-2 gap-5 mb-5">
          <MemberStats delay={0.2} />
          <ActivityTimeline delay={0.25} />
        </div>

        {/* Row 4: Security + Preferences */}
        <div className="grid lg:grid-cols-2 gap-5">
          {session && (
            <SecurityCard
              session={session}
              onDisconnect={handleDisconnect}
              onReconnect={handleReconnect}
              delay={0.3}
            />
          )}
          <PreferencesCard profile={profile} delay={0.35} />
        </div>

      </div>
    </DashboardLayout>
  );
}

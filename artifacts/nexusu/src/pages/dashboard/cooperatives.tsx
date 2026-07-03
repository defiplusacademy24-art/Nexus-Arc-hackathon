import { motion } from 'framer-motion';
import { Building2, MapPin, Users, Vault, Calendar, CheckCircle2, Sparkles, ChevronRight } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { DEMO_COOPERATIVE } from '@/lib/demo-data';
import { formatCurrency, formatDate } from '@/utils/format';
import { cn } from '@/lib/utils';

export default function Cooperatives() {
  const coop = DEMO_COOPERATIVE;

  return (
    <DashboardLayout>
      <div className="px-6 py-6 max-w-5xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
          <h1 className="text-xl font-display font-bold text-stone-900 dark:text-white">Cooperatives</h1>
          <p className="text-sm text-stone-400 dark:text-white/40 mt-0.5">Your cooperative workspaces</p>
        </motion.div>

        {/* Active cooperative card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-white/6 rounded-2xl overflow-hidden mb-5 hover:shadow-md dark:hover:border-white/10 transition-all"
        >
          {/* Header banner */}
          <div className="bg-gradient-to-r from-[#E8461E] to-[#F97316] p-6 text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white, transparent 70%)' }} />
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-semibold bg-white/20 px-2 py-0.5 rounded-full">{coop.type}</span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold bg-white/20 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                </div>
                <h2 className="text-2xl font-display font-bold">{coop.name}</h2>
                <div className="flex items-center gap-1.5 mt-1 text-white/70 text-sm">
                  <MapPin className="w-3.5 h-3.5" />
                  {coop.country}
                </div>
              </div>
              <div className="text-right">
                <p className="text-white/60 text-xs mb-1">Treasury</p>
                <p className="text-3xl font-display font-bold">{formatCurrency(coop.treasuryBalance)}</p>
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div className="p-6">
            <p className="text-sm text-stone-500 dark:text-white/50 mb-6 leading-relaxed">{coop.description}</p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Members', value: coop.memberCount, icon: Users },
                { label: 'Treasury', value: formatCurrency(coop.treasuryBalance), icon: Vault },
                { label: 'Governance Score', value: `${coop.governanceScore}/100`, icon: CheckCircle2 },
                { label: 'AI Health Score', value: `${coop.aiHealthScore}/100`, icon: Sparkles },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-stone-50 dark:bg-white/4 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-[#E8461E]" />
                    <p className="text-xs text-stone-400 dark:text-white/40">{label}</p>
                  </div>
                  <p className="text-base font-display font-bold text-stone-800 dark:text-white">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-stone-400 dark:text-white/30 uppercase tracking-widest">Contribution Rules</h3>
                {[
                  { l: 'Amount', v: formatCurrency(coop.contributionAmount) },
                  { l: 'Frequency', v: coop.contributionFrequency.charAt(0).toUpperCase() + coop.contributionFrequency.slice(1) },
                  { l: 'Currency', v: coop.currency },
                  { l: 'Founded', v: formatDate(coop.createdAt) },
                ].map(({ l, v }) => (
                  <div key={l} className="flex justify-between items-center py-2 border-b border-stone-50 dark:border-white/4 last:border-0">
                    <span className="text-sm text-stone-400 dark:text-white/40">{l}</span>
                    <span className="text-sm font-semibold text-stone-700 dark:text-white/80">{v}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-stone-400 dark:text-white/30 uppercase tracking-widest">Wallet Identity</h3>
                <div className="bg-stone-50 dark:bg-white/4 rounded-xl p-4">
                  <p className="text-[10px] text-stone-400 dark:text-white/30 mb-2 uppercase font-semibold tracking-wider">On-Chain Address</p>
                  <p className="font-mono text-xs text-stone-600 dark:text-white/60 break-all leading-relaxed">{coop.walletIdentity}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs text-emerald-500 font-semibold">Verified on Unicity Network</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Add workspace placeholder */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="border-2 border-dashed border-stone-200 dark:border-white/10 rounded-2xl p-8 text-center hover:border-[#E8461E]/30 dark:hover:border-[#E8461E]/20 transition-colors cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-3 group-hover:bg-[#E8461E]/8 transition-colors">
            <Building2 className="w-5 h-5 text-stone-400 dark:text-white/30 group-hover:text-[#E8461E]" />
          </div>
          <p className="font-semibold text-stone-600 dark:text-white/60 text-sm mb-1">Add a cooperative workspace</p>
          <p className="text-xs text-stone-400 dark:text-white/30">Join or create another cooperative to manage multiple organisations.</p>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Bell, Shield, Palette, Globe, Bot, ChevronRight, Check } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

function SettingRow({ label, description, children }: {
  label: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-4 border-b border-stone-50 dark:border-white/4 last:border-0">
      <div className="flex-1 min-w-0 sm:pr-4">
        <p className="text-sm font-medium text-stone-800 dark:text-white">{label}</p>
        {description && <p className="text-xs text-stone-400 dark:text-white/40 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0 self-start sm:self-center">{children}</div>
    </div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn(
        'relative w-10 h-6 rounded-full transition-colors flex-shrink-0',
        enabled ? 'bg-[#6393C4]' : 'bg-stone-200 dark:bg-white/15',
      )}
    >
      <span className={cn(
        'absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
        enabled ? 'left-5' : 'left-1',
      )} />
    </button>
  );
}

const SECTION_ICON: Record<string, React.ElementType> = {
  Notifications: Bell,
  Privacy: Shield,
  Appearance: Palette,
  Language: Globe,
  'AI & Automation': Bot,
};

interface SettingsSection {
  section: string;
  rows: Array<{ label: string; description?: string; type: 'toggle' | 'select' | 'link'; defaultOn?: boolean; options?: string[] }>;
}

const SETTINGS: SettingsSection[] = [
  {
    section: 'Notifications',
    rows: [
      { label: 'Contribution reminders', description: 'Get reminded 3 days before contribution is due', type: 'toggle', defaultOn: true },
      { label: 'Loan status updates', description: 'Updates when loan applications change status', type: 'toggle', defaultOn: true },
      { label: 'Governance alerts', description: 'New proposals and voting deadlines', type: 'toggle', defaultOn: true },
      { label: 'AI insights', description: 'Weekly Nexa AI health reports', type: 'toggle', defaultOn: false },
      { label: 'Member activity', description: 'When members join or leave', type: 'toggle', defaultOn: true },
    ],
  },
  {
    section: 'Privacy',
    rows: [
      { label: 'Show wallet address to members', description: 'Display your Arc wallet address in the member directory', type: 'toggle', defaultOn: false },
      { label: 'Analytics sharing', description: 'Share anonymous usage data to improve Nexusu', type: 'toggle', defaultOn: true },
      { label: 'Session timeout', description: 'Auto-disconnect after inactivity', type: 'select', options: ['30 minutes', '1 hour', '4 hours', 'Never'] },
    ],
  },
  {
    section: 'Appearance',
    rows: [
      { label: 'Currency display', description: 'How amounts are shown throughout the app', type: 'select', options: ['USD ($)', 'EUR (€)', 'GBP (£)', 'NGN (₦)', 'GHS (₵)'] },
      { label: 'Date format', description: '', type: 'select', options: ['MMM D, YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY'] },
    ],
  },
  {
    section: 'AI & Automation',
    rows: [
      { label: 'Nexa AI assistant', description: 'Enable AI-powered insights and recommendations', type: 'toggle', defaultOn: true },
      { label: 'Auto-reminders', description: 'Automatically send contribution reminders to members', type: 'toggle', defaultOn: false },
      { label: 'Fraud monitoring', description: 'Continuous AI monitoring for suspicious activity', type: 'toggle', defaultOn: true },
      { label: 'AI loan scoring', description: 'Use AI risk scores when reviewing loan applications', type: 'toggle', defaultOn: true },
    ],
  },
];

export default function SettingsPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const [toggles, setToggles] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    SETTINGS.forEach((s) => {
      s.rows.forEach((r) => {
        if (r.type === 'toggle') map[`${s.section}:${r.label}`] = r.defaultOn ?? false;
      });
    });
    return map;
  });

  const flip = (key: string) => setToggles((p) => ({ ...p, [key]: !p[key] }));

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 py-5 sm:py-6 max-w-2xl mx-auto">

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
          <h1 className="text-xl font-display font-bold text-stone-900 dark:text-white">Settings</h1>
          <p className="text-sm text-stone-400 dark:text-white/40 mt-0.5">Manage your Nexusu preferences</p>
        </motion.div>

        {/* Theme */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5 mb-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-4 h-4 text-[#6393C4]" />
            <h2 className="text-sm font-semibold text-stone-800 dark:text-white">Appearance</h2>
          </div>
          <p className="text-xs text-stone-400 dark:text-white/40 mb-3">Choose your preferred theme</p>
          <div className="flex gap-3">
            {[
              { key: 'light', label: 'Light', icon: '☀️' },
              { key: 'dark', label: 'Dark', icon: '🌙' },
              { key: 'system', label: 'System', icon: '💻' },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setTheme(key)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-2 py-3 rounded-xl border text-xs font-semibold transition-all',
                  resolvedTheme === key || (key === 'system' && !['light', 'dark'].includes(resolvedTheme ?? ''))
                    ? 'border-[#6393C4] bg-[#6393C4]/5 dark:bg-[#6393C4]/10 text-[#6393C4]'
                    : 'border-stone-200 dark:border-white/10 text-stone-500 dark:text-white/40 hover:border-stone-300 dark:hover:border-white/20',
                )}
              >
                <span className="text-lg">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Dynamic sections */}
        {SETTINGS.map((section, si) => {
          const Icon = SECTION_ICON[section.section] ?? Settings;
          return (
            <motion.div
              key={section.section}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + si * 0.05 }}
              className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] rounded-2xl p-5 mb-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-[#6393C4]" />
                <h2 className="text-sm font-semibold text-stone-800 dark:text-white">{section.section}</h2>
              </div>
              {section.rows.map((row) => (
                <SettingRow key={row.label} label={row.label} description={row.description}>
                  {row.type === 'toggle' && (
                    <Toggle
                      enabled={toggles[`${section.section}:${row.label}`] ?? false}
                      onChange={() => flip(`${section.section}:${row.label}`)}
                    />
                  )}
                  {row.type === 'select' && (
                    <select className="text-xs bg-stone-50 dark:bg-[#2E3B4B]/40 border border-stone-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-stone-700 dark:text-white/70 outline-none cursor-pointer flex-shrink-0">
                      {(row.options ?? []).map((o) => <option key={o}>{o}</option>)}
                    </select>
                  )}
                  {row.type === 'link' && (
                    <ChevronRight className="w-4 h-4 text-stone-300 dark:text-white/20 flex-shrink-0" />
                  )}
                </SettingRow>
              ))}
            </motion.div>
          );
        })}

        {/* Danger zone */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-red-50 dark:bg-red-500/6 border border-red-200 dark:border-red-500/20 rounded-2xl p-5"
        >
          <h2 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-3">Danger Zone</h2>
          <p className="text-xs text-red-600/80 dark:text-red-400/70 mb-4">These actions are irreversible. Please proceed with caution.</p>
          <div className="flex flex-col gap-2">
            <button className="w-full py-2.5 rounded-xl border border-red-300 dark:border-red-500/30 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 transition-colors">
              Leave Cooperative
            </button>
            <button className="w-full py-2.5 rounded-xl border border-red-300 dark:border-red-500/30 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 transition-colors">
              Delete Account
            </button>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

import { motion } from 'framer-motion';
import { Settings, Globe, Clock, Bell, Check, Save } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { UseProfileState } from '@/hooks/useProfile';
import { AVATAR_COLORS, LANGUAGES, type AvatarColor } from '@/services/unicity/profile';

interface PreferencesCardProps {
  profile: UseProfileState;
  delay?: number;
}

const TIMEZONES = [
  'Africa/Accra',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Johannesburg',
  'Africa/Cairo',
  'Africa/Casablanca',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Dubai',
];

export function PreferencesCard({ profile, delay = 0 }: PreferencesCardProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const { prefs, isDirty, update, setNotifPref, save, setAvatarColor } = profile;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-white/6 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-stone-100 dark:border-white/6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Settings className="w-4 h-4 text-[#E8461E]" />
          <span className="text-sm font-semibold text-stone-800 dark:text-white">Preferences</span>
        </div>
        {isDirty && (
          <motion.button
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={save}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E8461E] text-white text-xs font-semibold hover:bg-[#d43e1b] transition-colors"
          >
            <Save className="w-3 h-3" />
            Save
          </motion.button>
        )}
      </div>

      <div className="p-5 space-y-6">
        {/* Avatar color */}
        <div>
          <p className="text-xs font-semibold text-stone-500 dark:text-white/40 uppercase tracking-widest mb-3">
            Avatar Color
          </p>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(AVATAR_COLORS) as AvatarColor[]).map((color) => {
              const cfg = AVATAR_COLORS[color];
              const isActive = prefs.avatarColor === color;
              return (
                <button
                  key={color}
                  onClick={() => setAvatarColor(color)}
                  className={`w-8 h-8 rounded-full bg-gradient-to-br ${cfg.bg} flex items-center justify-center transition-all ${
                    isActive ? 'ring-2 ring-offset-2 ring-stone-400 dark:ring-white/50 scale-110' : 'hover:scale-105'
                  }`}
                  aria-label={cfg.label}
                >
                  {isActive && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Display name */}
        <div>
          <label className="text-xs font-semibold text-stone-500 dark:text-white/40 uppercase tracking-widest block mb-2">
            Display Name Override
          </label>
          <input
            type="text"
            value={prefs.displayNameOverride}
            onChange={(e) => update('displayNameOverride', e.target.value)}
            placeholder="Leave blank to use wallet identity"
            className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/8 text-sm text-stone-700 dark:text-white placeholder:text-stone-300 dark:placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#E8461E]/30 transition-all"
          />
          <p className="text-[10px] text-stone-400 dark:text-white/25 mt-1">
            This is a local preference — it doesn't change your on-chain identity.
          </p>
        </div>

        {/* Language */}
        <div>
          <label className="text-xs font-semibold text-stone-500 dark:text-white/40 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Globe className="w-3 h-3" />
            Language
          </label>
          <select
            value={prefs.language}
            onChange={(e) => update('language', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/8 text-sm text-stone-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E8461E]/30 transition-all"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        {/* Timezone */}
        <div>
          <label className="text-xs font-semibold text-stone-500 dark:text-white/40 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            Timezone
          </label>
          <select
            value={prefs.timezone}
            onChange={(e) => update('timezone', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/8 text-sm text-stone-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E8461E]/30 transition-all"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        {/* Theme */}
        <div>
          <p className="text-xs font-semibold text-stone-500 dark:text-white/40 uppercase tracking-widest mb-3">
            Theme
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`py-2.5 rounded-xl text-xs font-semibold capitalize transition-all border ${
                  resolvedTheme === t || (t === 'system' && !['light', 'dark'].includes(resolvedTheme ?? ''))
                    ? 'bg-[#E8461E] text-white border-[#E8461E]'
                    : 'border-stone-200 dark:border-white/10 text-stone-500 dark:text-white/40 hover:bg-stone-50 dark:hover:bg-white/5'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div>
          <p className="text-xs font-semibold text-stone-500 dark:text-white/40 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Bell className="w-3 h-3" />
            Notifications
          </p>
          <div className="space-y-2">
            {(
              [
                { key: 'contributions', label: 'Contribution reminders' },
                { key: 'loans', label: 'Loan updates' },
                { key: 'governance', label: 'Governance proposals' },
                { key: 'security', label: 'Security alerts' },
                { key: 'aiInsights', label: 'Nexa AI insights' },
              ] as const
            ).map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-stone-600 dark:text-white/65">{label}</span>
                <button
                  onClick={() => setNotifPref(key, !prefs.notifPrefs[key])}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    prefs.notifPrefs[key] ? 'bg-[#E8461E]' : 'bg-stone-200 dark:bg-white/10'
                  }`}
                >
                  <motion.div
                    animate={{ x: prefs.notifPrefs[key] ? 16 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

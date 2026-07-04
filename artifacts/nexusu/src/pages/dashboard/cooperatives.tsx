/**
 * Cooperatives — full cooperative management workspace.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import {
  Building2, Users, Vault, CheckCircle2, Sparkles, MapPin, Plus,
  UserPlus, Copy, QrCode, Settings, ChevronRight, MoreHorizontal,
  Shield, Crown, Briefcase, BookOpen, Eye, MoreVertical,
  ArrowUpRight, AlertCircle, Save, X, Mic2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { CreateWizard } from '@/components/cooperative/CreateWizard';
import { JoinModal } from '@/components/cooperative/JoinModal';
import { useCooperative } from '@/providers/CooperativeProvider';
import { useUnicity } from '@/providers/UnicityProvider';
import { loadCoopMembers, updateMemberRole, removeMember, updateMemberStatus } from '@/services/cooperative/members';
import { updateCooperative } from '@/services/cooperative/cooperative';
import { getInviteLink } from '@/services/cooperative/invitations';
import { formatCurrency, formatDate, roleLabel, roleBadgeClass } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { Cooperative, Member, MemberRole, CoopPrivacy, VotingModel, LoanApprovalPolicy, ContributionFrequency } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function CoopAvatar({ coop, size = 'lg' }: { coop: Cooperative; size?: 'sm' | 'md' | 'lg' }) {
  const initials = coop.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className={cn(
      'rounded-xl bg-gradient-to-br from-[#E8461E] to-[#F97316] flex items-center justify-center flex-shrink-0 font-bold text-white',
      size === 'lg' ? 'w-12 h-12 text-base' : size === 'md' ? 'w-9 h-9 text-sm' : 'w-7 h-7 text-xs',
    )}>
      {initials}
    </div>
  );
}

function MemberAvatar({ initials, size = 'md' }: { initials: string; size?: 'sm' | 'md' }) {
  const colours = ['from-[#E8461E] to-[#F97316]', 'from-purple-500 to-pink-500', 'from-blue-500 to-cyan-500', 'from-teal-500 to-emerald-500', 'from-amber-500 to-yellow-500'];
  return (
    <div className={cn(
      'rounded-full bg-gradient-to-br flex items-center justify-center flex-shrink-0 font-semibold text-white',
      size === 'md' ? 'w-8 h-8 text-xs' : 'w-6 h-6 text-[10px]',
      colours[initials.charCodeAt(0) % colours.length],
    )}>
      {initials}
    </div>
  );
}

const ROLE_ICON: Record<string, React.ElementType> = {
  founder: Crown,
  admin: Shield,
  treasurer: Briefcase,
  secretary: BookOpen,
  auditor: Eye,
  member: Users,
};

// ── Workspace Card ─────────────────────────────────────────────────────────────

function WorkspaceCard({ coop, active, onClick }: { coop: Cooperative; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-shrink-0 w-52 text-left p-4 rounded-2xl border transition-all',
        active
          ? 'border-[#E8461E] bg-[#E8461E]/5 dark:bg-[#E8461E]/8 shadow-sm'
          : 'border-stone-200 dark:border-white/8 bg-white dark:bg-stone-900/60 hover:border-stone-300 dark:hover:border-white/14',
      )}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <CoopAvatar coop={coop} size="md" />
        {active && (
          <span className="ml-auto text-[10px] font-semibold bg-[#E8461E] text-white px-2 py-0.5 rounded-full">Active</span>
        )}
      </div>
      <p className={cn('font-semibold text-sm leading-tight mb-0.5', active ? 'text-[#E8461E]' : 'text-stone-800 dark:text-white')}>{coop.name}</p>
      <p className="text-[11px] text-stone-400 dark:text-white/35">{coop.type} · {coop.country}</p>
      <p className="text-[11px] text-stone-500 dark:text-white/40 mt-2 font-semibold">{coop.memberCount} members</p>
    </button>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────────────

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="bg-stone-50 dark:bg-white/4 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-[#E8461E]" />
        <p className="text-xs text-stone-400 dark:text-white/40">{label}</p>
      </div>
      <p className="text-base font-display font-bold text-stone-800 dark:text-white">{value}</p>
    </div>
  );
}

// ── Member row ────────────────────────────────────────────────────────────────

const PROMOTABLE_ROLES: MemberRole[] = ['admin', 'treasurer', 'secretary', 'auditor', 'member'];

function MemberRow({
  member, isManager, cooperativeId, onUpdate,
}: {
  member: Member;
  isManager: boolean;
  cooperativeId: string;
  onUpdate: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const RoleIcon = ROLE_ICON[member.role] ?? Users;

  const handleRoleChange = (role: MemberRole) => {
    updateMemberRole(cooperativeId, member.id, role);
    setMenuOpen(false);
    onUpdate();
  };

  const handleRemove = () => {
    removeMember(cooperativeId, member.id);
    setMenuOpen(false);
    onUpdate();
  };

  const handleSuspend = () => {
    updateMemberStatus(cooperativeId, member.id, member.status === 'suspended' ? 'active' : 'suspended');
    setMenuOpen(false);
    onUpdate();
  };

  return (
    <tr className="border-b border-stone-50 dark:border-white/4 last:border-0 hover:bg-stone-50/50 dark:hover:bg-white/2 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <MemberAvatar initials={member.initials} />
          <div>
            <p className="text-sm font-medium text-stone-800 dark:text-white">{member.name}</p>
            <p className="text-[10px] text-stone-400 dark:text-white/30 font-mono">
              {member.walletIdentity.slice(0, 14)}…
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border', roleBadgeClass(member.role))}>
          <RoleIcon className="w-2.5 h-2.5" />
          {roleLabel(member.role)}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={cn(
          'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
          member.status === 'active'
            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
            : member.status === 'suspended'
            ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'
            : 'bg-stone-50 dark:bg-white/5 text-stone-500 dark:text-white/35 border-stone-200 dark:border-white/10',
        )}>
          {member.status}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-stone-500 dark:text-white/40 font-mono">{formatCurrency(member.totalContributed)}</td>
      <td className="px-4 py-3 text-xs text-stone-400 dark:text-white/35 whitespace-nowrap">{formatDate(member.joinedAt)}</td>
      <td className="px-4 py-3">
        {isManager && member.role !== 'founder' && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="p-1.5 rounded-lg text-stone-300 dark:text-white/20 hover:text-stone-600 dark:hover:text-white/60 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    className="absolute right-0 top-8 z-50 w-44 bg-white dark:bg-stone-900 border border-stone-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden"
                  >
                    <div className="p-1">
                      <p className="px-3 py-1.5 text-[10px] font-semibold text-stone-400 dark:text-white/30 uppercase tracking-wider">Change Role</p>
                      {PROMOTABLE_ROLES.filter((r) => r !== member.role).map((r) => {
                        const RIcon = ROLE_ICON[r] ?? Users;
                        return (
                          <button key={r} onClick={() => handleRoleChange(r)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-stone-600 dark:text-white/60 hover:bg-stone-50 dark:hover:bg-white/5 rounded-lg transition-colors">
                            <RIcon className="w-3.5 h-3.5" /> {roleLabel(r)}
                          </button>
                        );
                      })}
                    </div>
                    <div className="border-t border-stone-100 dark:border-white/6 p-1">
                      <button onClick={handleSuspend}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/8 rounded-lg transition-colors">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {member.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                      </button>
                      <button onClick={handleRemove}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/8 rounded-lg transition-colors">
                        <ArrowUpRight className="w-3.5 h-3.5 rotate-180" /> Remove Member
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Governance summary ────────────────────────────────────────────────────────

const VOTING_LABELS: Record<string, string> = {
  'simple-majority': 'Simple Majority',
  supermajority: 'Supermajority (≥66%)',
  unanimous: 'Unanimous',
};

const LOAN_POLICY_LABELS: Record<string, string> = {
  'admin-only': 'Admin Decision',
  'member-vote': 'Member Vote',
  'ai-recommended': 'AI Recommendation',
  hybrid: 'Hybrid (AI + Vote)',
};

const PRIVACY_LABELS: Record<string, string> = {
  public: 'Public',
  private: 'Private',
  'invite-only': 'Invite Only',
};

// ── Settings Panel ────────────────────────────────────────────────────────────

interface SettingsForm {
  name: string;
  description: string;
  country: string;
  currency: string;
  contributionAmount: string;
  contributionFrequency: ContributionFrequency;
  maxMembers: string;
  privacy: CoopPrivacy;
  votingModel: VotingModel;
  approvalThreshold: number;
  loanApprovalPolicy: LoanApprovalPolicy;
  aiGovernanceEnabled: boolean;
}

const COUNTRIES = ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Tanzania', 'Uganda', 'Ethiopia', 'Cameroon', 'Senegal', 'Ivory Coast', 'Zimbabwe', 'Zambia', 'Rwanda', 'United Kingdom', 'United States', 'Canada', 'Other'];
const CURRENCIES = [{ value: 'USD', label: 'USD — US Dollar' }, { value: 'NGN', label: 'NGN — Nigerian Naira' }, { value: 'GHS', label: 'GHS — Ghanaian Cedi' }, { value: 'KES', label: 'KES — Kenyan Shilling' }, { value: 'ZAR', label: 'ZAR — South African Rand' }, { value: 'GBP', label: 'GBP — British Pound' }, { value: 'EUR', label: 'EUR — Euro' }];

function SettingsRadio<T extends string>({ value, current, onChange, label, desc }: { value: T; current: T; onChange: (v: T) => void; label: string; desc?: string }) {
  const active = value === current;
  return (
    <button type="button" onClick={() => onChange(value)} className={cn('w-full text-left px-3 py-2.5 rounded-xl border transition-all text-sm', active ? 'border-[#E8461E] bg-[#E8461E]/5 dark:bg-[#E8461E]/8' : 'border-stone-200 dark:border-white/10 hover:border-stone-300 dark:hover:border-white/20 bg-stone-50 dark:bg-white/3')}>
      <div className="flex items-center gap-3">
        <div className={cn('w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center', active ? 'border-[#E8461E]' : 'border-stone-300 dark:border-white/25')}>
          {active && <div className="w-2 h-2 rounded-full bg-[#E8461E]" />}
        </div>
        <div>
          <p className={cn('font-semibold', active ? 'text-[#E8461E]' : 'text-stone-700 dark:text-white/80')}>{label}</p>
          {desc && <p className="text-[11px] text-stone-400 dark:text-white/35 mt-0.5">{desc}</p>}
        </div>
      </div>
    </button>
  );
}

function SettingsField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-stone-500 dark:text-white/50 uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-stone-400 dark:text-white/30">{hint}</p>}
    </div>
  );
}

function SettingsInput({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-white placeholder:text-stone-400 dark:placeholder:text-white/25 outline-none focus:border-[#E8461E]/50 focus:ring-2 focus:ring-[#E8461E]/10 transition-all" />
  );
}

function SettingsSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-white outline-none focus:border-[#E8461E]/50 focus:ring-2 focus:ring-[#E8461E]/10 transition-all">
      {children}
    </select>
  );
}

type SettingsTab = 'basic' | 'rules' | 'governance';

function CoopSettingsPanel({ coop, onClose }: { coop: Cooperative; onClose: () => void }) {
  const { updateCooperative } = useCooperative();
  const [tab, setTab] = useState<SettingsTab>('basic');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<SettingsForm>({
    name: coop.name,
    description: coop.description,
    country: coop.country,
    currency: coop.currency,
    contributionAmount: String(coop.contributionAmount),
    contributionFrequency: coop.contributionFrequency,
    maxMembers: coop.maxMembers ? String(coop.maxMembers) : '',
    privacy: coop.privacy ?? 'invite-only',
    votingModel: coop.votingModel ?? 'simple-majority',
    approvalThreshold: coop.approvalThreshold ?? 60,
    loanApprovalPolicy: coop.loanApprovalPolicy ?? 'hybrid',
    aiGovernanceEnabled: coop.aiGovernanceEnabled !== false,
  });

  const set = (k: keyof SettingsForm, v: string | number | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    setSaving(true);
    try {
      updateCooperative(coop.id, {
        name: form.name.trim() || coop.name,
        description: form.description.trim() || coop.description,
        country: form.country,
        currency: form.currency,
        contributionAmount: Number(form.contributionAmount) || coop.contributionAmount,
        contributionFrequency: form.contributionFrequency,
        maxMembers: form.maxMembers ? Number(form.maxMembers) : undefined,
        privacy: form.privacy,
        votingModel: form.votingModel,
        approvalThreshold: form.approvalThreshold,
        loanApprovalPolicy: form.loanApprovalPolicy,
        aiGovernanceEnabled: form.aiGovernanceEnabled,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'rules', label: 'Rules' },
    { id: 'governance', label: 'Governance' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="w-full max-w-md bg-white dark:bg-stone-950 border-l border-stone-100 dark:border-white/6 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 dark:border-white/6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#E8461E]/10 flex items-center justify-center">
              <Settings className="w-4 h-4 text-[#E8461E]" />
            </div>
            <div>
              <h2 className="font-display font-bold text-stone-900 dark:text-white text-sm">Cooperative Settings</h2>
              <p className="text-[11px] text-stone-400 dark:text-white/35">{coop.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-stone-400 dark:text-white/30 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 py-3 border-b border-stone-100 dark:border-white/6 flex-shrink-0">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all', tab === t.id ? 'bg-[#E8461E] text-white' : 'text-stone-500 dark:text-white/40 hover:bg-stone-100 dark:hover:bg-white/6')}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }} className="space-y-5">
              {tab === 'basic' && (
                <>
                  <SettingsField label="Cooperative Name">
                    <SettingsInput value={form.name} onChange={(v) => set('name', v)} placeholder="Cooperative name" />
                  </SettingsField>
                  <SettingsField label="Description">
                    <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={4} placeholder="What is the purpose of this cooperative?"
                      className="w-full bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-white placeholder:text-stone-400 dark:placeholder:text-white/25 outline-none focus:border-[#E8461E]/50 focus:ring-2 focus:ring-[#E8461E]/10 transition-all resize-none" />
                  </SettingsField>
                  <div className="grid grid-cols-2 gap-4">
                    <SettingsField label="Country">
                      <SettingsSelect value={form.country} onChange={(v) => set('country', v)}>
                        {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </SettingsSelect>
                    </SettingsField>
                    <SettingsField label="Currency">
                      <SettingsSelect value={form.currency} onChange={(v) => set('currency', v)}>
                        {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </SettingsSelect>
                    </SettingsField>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-500/8 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Cooperative ID & Invite Code</p>
                    <p className="text-[11px] text-amber-600 dark:text-amber-500">These are permanent identifiers and cannot be changed after creation. Share the invite code with members to grow your cooperative.</p>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-amber-600/70 dark:text-amber-400/60">Cooperative ID</span>
                        <span className="font-mono text-xs font-bold text-amber-800 dark:text-amber-300">{coop.cooperativeId ?? '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-amber-600/70 dark:text-amber-400/60">Invite Code</span>
                        <span className="font-mono text-xs font-bold text-amber-800 dark:text-amber-300">{coop.inviteCode ?? '—'}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {tab === 'rules' && (
                <>
                  <SettingsField label={`Contribution Amount (${form.currency})`}>
                    <SettingsInput value={form.contributionAmount} onChange={(v) => set('contributionAmount', v)} type="number" placeholder="e.g. 350" />
                  </SettingsField>
                  <SettingsField label="Contribution Frequency">
                    <div className="space-y-2">
                      {([['weekly', 'Weekly', 'Contributions every week'], ['bi-weekly', 'Bi-Weekly', 'Every two weeks'], ['monthly', 'Monthly', 'Once a month']] as [ContributionFrequency, string, string][]).map(([v, l, d]) => (
                        <SettingsRadio key={v} value={v} current={form.contributionFrequency} onChange={(val) => set('contributionFrequency', val)} label={l} desc={d} />
                      ))}
                    </div>
                  </SettingsField>
                  <SettingsField label="Maximum Members" hint="Leave blank for unlimited">
                    <SettingsInput value={form.maxMembers} onChange={(v) => set('maxMembers', v)} type="number" placeholder="e.g. 30" />
                  </SettingsField>
                  <SettingsField label="Privacy">
                    <div className="space-y-2">
                      {([['public', 'Public', 'Anyone can find and request to join'], ['private', 'Private', 'Hidden, admin-approved only'], ['invite-only', 'Invite Only', 'Members join via invite code']] as [CoopPrivacy, string, string][]).map(([v, l, d]) => (
                        <SettingsRadio key={v} value={v} current={form.privacy} onChange={(val) => set('privacy', val)} label={l} desc={d} />
                      ))}
                    </div>
                  </SettingsField>
                </>
              )}

              {tab === 'governance' && (
                <>
                  <SettingsField label="Voting Model">
                    <div className="space-y-2">
                      {([['simple-majority', 'Simple Majority', 'More than 50% of votes needed'], ['supermajority', 'Supermajority', '66% or more votes needed'], ['unanimous', 'Unanimous', '100% agreement required']] as [VotingModel, string, string][]).map(([v, l, d]) => (
                        <SettingsRadio key={v} value={v} current={form.votingModel} onChange={(val) => set('votingModel', val)} label={l} desc={d} />
                      ))}
                    </div>
                  </SettingsField>
                  <SettingsField label={`Approval Threshold — ${form.approvalThreshold}%`} hint="Percentage of votes required to pass a proposal">
                    <input type="range" min={50} max={100} step={1} value={form.approvalThreshold}
                      onChange={(e) => set('approvalThreshold', Number(e.target.value))}
                      className="w-full h-2 bg-stone-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#E8461E]" />
                    <div className="flex justify-between text-[10px] text-stone-400 dark:text-white/30 mt-1">
                      <span>50%</span><span>75%</span><span>100%</span>
                    </div>
                  </SettingsField>
                  <SettingsField label="Loan Approval Policy">
                    <div className="space-y-2">
                      {([['admin-only', 'Admin Decision', 'Admin or treasurer approves loans'], ['member-vote', 'Member Vote', 'Members vote on each loan request'], ['ai-recommended', 'AI Recommendation', 'Nexa AI assesses and recommends'], ['hybrid', 'Hybrid', 'AI assessment + member ratification']] as [LoanApprovalPolicy, string, string][]).map(([v, l, d]) => (
                        <SettingsRadio key={v} value={v} current={form.loanApprovalPolicy} onChange={(val) => set('loanApprovalPolicy', val)} label={l} desc={d} />
                      ))}
                    </div>
                  </SettingsField>
                  <SettingsField label="AI Governance Assistance">
                    <button type="button" onClick={() => set('aiGovernanceEnabled', !form.aiGovernanceEnabled)}
                      className={cn('flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-all', form.aiGovernanceEnabled ? 'border-[#E8461E] bg-[#E8461E]/5 dark:bg-[#E8461E]/8' : 'border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/3')}>
                      <Sparkles className={cn('w-4 h-4', form.aiGovernanceEnabled ? 'text-[#E8461E]' : 'text-stone-400')} />
                      <div className="flex-1 text-left">
                        <p className={cn('text-sm font-semibold', form.aiGovernanceEnabled ? 'text-[#E8461E]' : 'text-stone-600 dark:text-white/60')}>Nexa AI Assistance</p>
                        <p className="text-[11px] text-stone-400 dark:text-white/35">AI-powered insights, risk assessment, and governance recommendations</p>
                      </div>
                      <div className={cn('w-10 h-6 rounded-full transition-all flex items-center px-0.5', form.aiGovernanceEnabled ? 'bg-[#E8461E]' : 'bg-stone-200 dark:bg-white/10')}>
                        <div className={cn('w-5 h-5 rounded-full bg-white shadow-sm transition-all', form.aiGovernanceEnabled ? 'translate-x-4' : 'translate-x-0')} />
                      </div>
                    </button>
                  </SettingsField>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-100 dark:border-white/6 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#E8461E] text-white text-sm font-semibold hover:bg-[#D03D18] disabled:opacity-60 transition-colors"
          >
            {saved ? (
              <><CheckCircle2 className="w-4 h-4" /> Saved!</>
            ) : (
              <><Save className="w-4 h-4" /> Save Changes</>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Cooperatives() {
  const { cooperatives, activeCooperative, setActiveCooperative, refresh } = useCooperative();
  const { identity } = useUnicity();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [membersExpanded, setMembersExpanded] = useState(false);

  // Reload members whenever the active cooperative changes
  useEffect(() => {
    setMembers(activeCooperative ? loadCoopMembers(activeCooperative.id) : []);
    setMembersExpanded(false);
  }, [activeCooperative?.id]);

  const reloadMembers = () => {
    if (!activeCooperative) return;
    const updated = loadCoopMembers(activeCooperative.id);
    setMembers(updated);
    // Keep memberCount in sync with actual stored members
    updateCooperative(activeCooperative.id, { memberCount: updated.length });
    refresh();
  };

  const switchCoop = (id: string) => {
    setActiveCooperative(id);
    setMembers(loadCoopMembers(id));
  };

  // isManager is true only when the connected wallet is a founder or admin of this cooperative,
  // OR the cooperative was created by this wallet (founderWalletIdentity matches).
  // Never falls back to any-admin logic — requires an authenticated wallet match.
  const currentWallet = identity?.walletAddress ?? '';
  const myMembership = currentWallet
    ? members.find((m) => m.walletIdentity === currentWallet)
    : null;
  const isFounder = Boolean(currentWallet && activeCooperative?.founderWalletIdentity === currentWallet);
  const isManager = isFounder || Boolean(myMembership && (myMembership.role === 'founder' || myMembership.role === 'admin'));

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const inviteCode = activeCooperative?.inviteCode ?? 'SSC-A2B-3C4';
  const inviteLink = getInviteLink(inviteCode);

  const displayedMembers = membersExpanded ? members : members.slice(0, 8);

  if (!activeCooperative) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-full py-24 px-6 text-center">
          <Building2 className="w-12 h-12 text-stone-200 dark:text-white/10 mb-4" />
          <p className="font-display font-bold text-stone-800 dark:text-white mb-2">No Cooperative Yet</p>
          <p className="text-sm text-stone-400 dark:text-white/40 mb-6">Create a new cooperative or join one with an invite code.</p>
          <div className="flex gap-3">
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E8461E] text-white text-sm font-semibold hover:bg-[#D03D18] transition-colors">
              <Plus className="w-4 h-4" /> Create Cooperative
            </button>
            <button onClick={() => setShowJoin(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 dark:border-white/10 text-stone-600 dark:text-white/60 text-sm font-semibold hover:bg-stone-50 dark:hover:bg-white/5 transition-colors">
              <UserPlus className="w-4 h-4" /> Join with Code
            </button>
          </div>
          {showCreate && <CreateWizard onClose={() => { setShowCreate(false); refresh(); }} />}
          {showJoin && <JoinModal onClose={() => { setShowJoin(false); refresh(); }} />}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="px-6 py-6 max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-display font-bold text-stone-900 dark:text-white">Cooperatives</h1>
            <p className="text-sm text-stone-400 dark:text-white/40 mt-0.5">
              {cooperatives.length === 1 ? '1 workspace' : `${cooperatives.length} workspaces`}
            </p>
          </div>
          <div className="flex gap-2.5">
            {isManager && (
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-200 dark:border-white/10 text-stone-600 dark:text-white/60 text-sm font-semibold hover:bg-stone-50 dark:hover:bg-white/5 transition-colors"
              >
                <Settings className="w-3.5 h-3.5" /> Settings
              </button>
            )}
            <button
              onClick={() => setShowJoin(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-200 dark:border-white/10 text-stone-600 dark:text-white/60 text-sm font-semibold hover:bg-stone-50 dark:hover:bg-white/5 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" /> Join
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E8461E] text-white text-sm font-semibold hover:bg-[#D03D18] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Create Cooperative
            </button>
          </div>
        </motion.div>

        {/* Workspace strip */}
        {cooperatives.length > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.08 }}
            className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin"
          >
            {cooperatives.map((coop) => (
              <WorkspaceCard
                key={coop.id}
                coop={coop}
                active={coop.id === activeCooperative.id}
                onClick={() => switchCoop(coop.id)}
              />
            ))}
            <button
              onClick={() => setShowCreate(true)}
              className="flex-shrink-0 w-52 p-4 rounded-2xl border-2 border-dashed border-stone-200 dark:border-white/10 hover:border-[#E8461E]/40 dark:hover:border-[#E8461E]/20 transition-colors group flex flex-col items-center justify-center gap-2 text-center"
            >
              <div className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-white/5 flex items-center justify-center group-hover:bg-[#E8461E]/8 transition-colors">
                <Plus className="w-5 h-5 text-stone-400 dark:text-white/30 group-hover:text-[#E8461E]" />
              </div>
              <p className="text-xs font-semibold text-stone-400 dark:text-white/30 group-hover:text-stone-600 dark:group-hover:text-white/60">Add cooperative</p>
            </button>
          </motion.div>
        )}

        {/* Active cooperative banner */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-white/6 rounded-2xl overflow-hidden"
        >
          <div className="bg-gradient-to-r from-[#E8461E] to-[#F97316] p-6 text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white, transparent 70%)' }} />
            <div className="flex items-start justify-between gap-4 relative">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center font-bold text-xl flex-shrink-0">
                  {activeCooperative.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-semibold bg-white/20 px-2 py-0.5 rounded-full">{activeCooperative.type}</span>
                    {activeCooperative.privacy && (
                      <span className="text-[11px] font-semibold bg-white/20 px-2 py-0.5 rounded-full">{PRIVACY_LABELS[activeCooperative.privacy] ?? activeCooperative.privacy}</span>
                    )}
                    <span className="flex items-center gap-1 text-[11px] font-semibold bg-white/20 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Active
                    </span>
                  </div>
                  <h2 className="text-2xl font-display font-bold">{activeCooperative.name}</h2>
                  <div className="flex items-center gap-1.5 mt-0.5 text-white/70 text-sm">
                    <MapPin className="w-3.5 h-3.5" />
                    {activeCooperative.country}
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white/60 text-xs mb-1">Treasury</p>
                <p className="text-3xl font-display font-bold">{formatCurrency(activeCooperative.treasuryBalance)}</p>
                <Link href="/dashboard/treasury" className="mt-1 flex items-center gap-1 text-white/60 text-[11px] hover:text-white transition-colors justify-end">
                  View Treasury <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>

          <div className="p-6">
            <p className="text-sm text-stone-500 dark:text-white/50 mb-6 leading-relaxed">{activeCooperative.description}</p>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Stat label="Members" value={activeCooperative.memberCount} icon={Users} />
              <Stat label="Treasury" value={formatCurrency(activeCooperative.treasuryBalance)} icon={Vault} />
              <Stat label="Governance Score" value={`${activeCooperative.governanceScore}/100`} icon={CheckCircle2} />
              <Stat label="AI Health Score" value={`${activeCooperative.aiHealthScore}/100`} icon={Sparkles} />
            </div>

            {/* Rules + Governance + Invite */}
            <div className="grid lg:grid-cols-3 gap-5">
              {/* Contribution Rules */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-stone-400 dark:text-white/30 uppercase tracking-widest">Contribution Rules</h3>
                {[
                  { l: 'Amount', v: formatCurrency(activeCooperative.contributionAmount, activeCooperative.currency) },
                  { l: 'Frequency', v: activeCooperative.contributionFrequency.charAt(0).toUpperCase() + activeCooperative.contributionFrequency.slice(1) },
                  { l: 'Currency', v: activeCooperative.currency },
                  { l: 'Max Members', v: activeCooperative.maxMembers ? String(activeCooperative.maxMembers) : 'Unlimited' },
                  { l: 'Founded', v: formatDate(activeCooperative.createdAt) },
                ].map(({ l, v }) => (
                  <div key={l} className="flex justify-between items-center py-2 border-b border-stone-50 dark:border-white/4 last:border-0">
                    <span className="text-sm text-stone-400 dark:text-white/40">{l}</span>
                    <span className="text-sm font-semibold text-stone-700 dark:text-white/80">{v}</span>
                  </div>
                ))}
              </div>

              {/* Governance */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-stone-400 dark:text-white/30 uppercase tracking-widest">Governance</h3>
                {[
                  { l: 'Voting Model', v: VOTING_LABELS[activeCooperative.votingModel ?? 'simple-majority'] },
                  { l: 'Approval Threshold', v: `${activeCooperative.approvalThreshold ?? 60}%` },
                  { l: 'Loan Policy', v: LOAN_POLICY_LABELS[activeCooperative.loanApprovalPolicy ?? 'hybrid'] },
                  { l: 'AI Governance', v: activeCooperative.aiGovernanceEnabled !== false ? 'Enabled' : 'Disabled' },
                ].map(({ l, v }) => (
                  <div key={l} className="flex justify-between items-center py-2 border-b border-stone-50 dark:border-white/4 last:border-0">
                    <span className="text-sm text-stone-400 dark:text-white/40">{l}</span>
                    <span className="text-sm font-semibold text-stone-700 dark:text-white/80">{v}</span>
                  </div>
                ))}
              </div>

              {/* Invite & Share */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-stone-400 dark:text-white/30 uppercase tracking-widest">Invite & Share</h3>
                <div className="bg-stone-50 dark:bg-white/4 rounded-xl p-4 space-y-3">
                  {/* QR Code */}
                  <div className="flex justify-center">
                    <div className="bg-white rounded-xl p-2.5 shadow-sm">
                      <QRCodeSVG value={inviteLink} size={110} fgColor="#1c1917" bgColor="transparent" />
                    </div>
                  </div>
                  {/* Invite Code */}
                  <div>
                    <p className="text-[10px] text-stone-400 dark:text-white/30 font-semibold uppercase tracking-wider mb-1.5">Invite Code</p>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-stone-800 dark:text-white tracking-widest flex-1">{inviteCode}</span>
                      <button
                        onClick={() => copy(inviteCode, 'code')}
                        className="p-1.5 rounded-lg bg-white dark:bg-white/8 border border-stone-200 dark:border-white/10 text-stone-400 dark:text-white/40 hover:text-[#E8461E] transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* Invite link */}
                  <button
                    onClick={() => copy(inviteLink, 'link')}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#E8461E]/8 dark:bg-[#E8461E]/10 text-[#E8461E] text-xs font-semibold hover:bg-[#E8461E]/14 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied === 'link' ? 'Link copied!' : copied === 'code' ? 'Code copied!' : 'Copy Invite Link'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Members section */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-white/6 rounded-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-stone-50 dark:border-white/4">
            <div>
              <h2 className="font-display font-bold text-stone-900 dark:text-white text-base">Members</h2>
              <p className="text-xs text-stone-400 dark:text-white/35 mt-0.5">{members.length} total · {members.filter((m) => m.status === 'active').length} active</p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/dashboard/members"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-white/10 text-stone-500 dark:text-white/50 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-white/5 transition-colors"
              >
                All Members <ChevronRight className="w-3 h-3" />
              </Link>
              <button
                onClick={() => setShowJoin(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E8461E] text-white text-xs font-semibold hover:bg-[#D03D18] transition-colors"
              >
                <UserPlus className="w-3 h-3" /> Invite
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-50 dark:border-white/4">
                  {['Member', 'Role', 'Status', 'Contributed', 'Joined', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-stone-400 dark:text-white/30 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedMembers.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    isManager={isManager}
                    cooperativeId={activeCooperative.id}
                    onUpdate={reloadMembers}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {members.length > 8 && (
            <div className="px-6 py-3 border-t border-stone-50 dark:border-white/4">
              <button
                onClick={() => setMembersExpanded((e) => !e)}
                className="text-xs font-semibold text-stone-400 dark:text-white/40 hover:text-[#E8461E] transition-colors"
              >
                {membersExpanded ? 'Show less' : `Show ${members.length - 8} more members`}
              </button>
            </div>
          )}

          {members.length === 0 && (
            <div className="py-12 text-center">
              <Users className="w-8 h-8 text-stone-200 dark:text-white/10 mx-auto mb-3" />
              <p className="text-sm text-stone-400 dark:text-white/40">No members yet. Invite your first members.</p>
            </div>
          )}
        </motion.div>

        {/* Add another workspace CTA (only when 1 coop) */}
        {cooperatives.length === 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="border-2 border-dashed border-stone-200 dark:border-white/10 rounded-2xl p-8 text-center hover:border-[#E8461E]/30 dark:hover:border-[#E8461E]/20 transition-colors cursor-pointer group"
            onClick={() => setShowCreate(true)}
          >
            <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-3 group-hover:bg-[#E8461E]/8 transition-colors">
              <Building2 className="w-5 h-5 text-stone-400 dark:text-white/30 group-hover:text-[#E8461E]" />
            </div>
            <p className="font-semibold text-stone-600 dark:text-white/60 text-sm mb-1">Add another workspace</p>
            <p className="text-xs text-stone-400 dark:text-white/30">Create or join another cooperative to manage multiple organisations.</p>
          </motion.div>
        )}
      </div>

      {/* Modals & Panels */}
      <AnimatePresence>
        {showCreate && <CreateWizard onClose={() => { setShowCreate(false); refresh(); }} />}
        {showJoin && <JoinModal onClose={() => { setShowJoin(false); refresh(); }} />}
        {showSettings && activeCooperative && (
          <CoopSettingsPanel
            coop={activeCooperative}
            onClose={() => { setShowSettings(false); refresh(); }}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

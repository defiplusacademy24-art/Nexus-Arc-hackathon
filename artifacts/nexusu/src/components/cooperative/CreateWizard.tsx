/**
 * CreateWizard — 4-step modal wizard for creating a new cooperative.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Check, Building2, Sparkles, Copy, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';
import { useCooperative } from '@/providers/CooperativeProvider';
import { useWallet } from '@/providers/WalletProvider';
import { generateInviteCode, generateCoopId, getInviteLink } from '@/services/cooperative/invitations';
import {
  ROTATION_MODE_DESCRIPTIONS,
  ROTATION_MODE_LABELS,
  isRotationModeImplemented,
} from '@/services/cooperative/rotation';
import type {
  CoopType, ContributionFrequency, CoopPrivacy, VotingModel, LoanApprovalPolicy, RotationMode,
} from '@/types';
import { MIN_CONTRIBUTION_USDC } from '@/config/treasury-vault';

// ── Form state ────────────────────────────────────────────────────────────────

interface WizardForm {
  name: string; description: string; country: string; currency: string; type: CoopType;
  contributionFrequency: ContributionFrequency; contributionAmount: string;
  maxMembers: string; privacy: CoopPrivacy;
  rotationMode: RotationMode;
  votingModel: VotingModel; approvalThreshold: number;
  loanApprovalPolicy: LoanApprovalPolicy; aiGovernanceEnabled: boolean;
}

const DEFAULTS: WizardForm = {
  name: '', description: '', country: '', currency: 'USD', type: 'Stokvel',
  contributionFrequency: 'monthly', contributionAmount: '', maxMembers: '',
  privacy: 'invite-only', rotationMode: 'JOIN_ORDER',
  votingModel: 'simple-majority', approvalThreshold: 60,
  loanApprovalPolicy: 'hybrid', aiGovernanceEnabled: true,
};

const ROTATION_OPTIONS: RotationMode[] = [
  'JOIN_ORDER',
  'RANDOM',
  'ORGANIZER_ASSIGNED',
  'GOVERNANCE_VOTE',
];

// ── Options ───────────────────────────────────────────────────────────────────

const COOP_TYPES: { value: CoopType; label: string; desc: string }[] = [
  { value: 'Stokvel', label: 'Stokvel', desc: 'South African rotating savings club' },
  { value: 'Chama', label: 'Chama', desc: 'East African investment group' },
  { value: 'Esusu', label: 'Esusu', desc: 'West African rotating credit association' },
  { value: 'Ajo', label: 'Ajo', desc: 'Nigerian daily savings collector' },
  { value: 'Susu', label: 'Susu', desc: 'Ghanaian/Caribbean savings club' },
  { value: 'ROSCA', label: 'ROSCA', desc: 'Rotating savings and credit association' },
  { value: 'SACCO', label: 'SACCO', desc: 'Savings and credit cooperative organisation' },
  { value: 'General', label: 'General', desc: 'General cooperative organisation' },
  { value: 'Other', label: 'Other', desc: 'Custom cooperative type' },
];

const COUNTRIES = [
  'Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Tanzania', 'Uganda', 'Ethiopia',
  'Cameroon', 'Senegal', 'Ivory Coast', 'Zimbabwe', 'Zambia', 'Rwanda',
  'United Kingdom', 'United States', 'Canada', 'Other',
];

const CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'NGN', label: 'NGN — Nigerian Naira' },
  { value: 'GHS', label: 'GHS — Ghanaian Cedi' },
  { value: 'KES', label: 'KES — Kenyan Shilling' },
  { value: 'ZAR', label: 'ZAR — South African Rand' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'TZS', label: 'TZS — Tanzanian Shilling' },
];

const VOTING_MODELS: { value: VotingModel; label: string; desc: string }[] = [
  { value: 'simple-majority', label: 'Simple Majority', desc: 'More than 50% of votes needed' },
  { value: 'supermajority', label: 'Supermajority', desc: '66% or more votes needed' },
  { value: 'unanimous', label: 'Unanimous', desc: '100% agreement required' },
];

const LOAN_POLICIES: { value: LoanApprovalPolicy; label: string; desc: string }[] = [
  { value: 'admin-only', label: 'Admin Decision', desc: 'Admin or treasurer approves loans' },
  { value: 'member-vote', label: 'Member Vote', desc: 'Members vote on each loan request' },
  { value: 'ai-recommended', label: 'AI Recommendation', desc: 'Nexa AI assesses and recommends' },
  { value: 'hybrid', label: 'Hybrid', desc: 'AI assessment + member ratification' },
];

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  const steps = ['Basic Info', 'Rules', 'Governance', 'Identity'];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <div key={n} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                done ? 'bg-[#6393C4] text-white' : active ? 'bg-[#6393C4] text-white ring-4 ring-[#6393C4]/20' : 'bg-stone-100 dark:bg-white/8 text-stone-400 dark:text-white/30',
              )}>
                {done ? <Check className="w-3.5 h-3.5" /> : n}
              </div>
              <span className={cn('text-[10px] font-semibold whitespace-nowrap', active ? 'text-[#6393C4]' : 'text-stone-400 dark:text-white/30')}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn('flex-1 h-px mx-2 mb-4', done ? 'bg-[#6393C4]' : 'bg-stone-200 dark:bg-white/10')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-stone-500 dark:text-white/50 uppercase tracking-wide">
        {label}{required && <span className="text-[#6393C4] ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-stone-400 dark:text-white/30">{hint}</p>}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  min,
  step,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  min?: number | string;
  step?: number | string;
}) {
  return (
    <input
      type={type}
      value={value}
      min={min}
      step={step}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-stone-50 dark:bg-[#2E3B4B]/40 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-white placeholder:text-stone-400 dark:placeholder:text-white/25 outline-none focus:border-[#6393C4]/50 focus:ring-2 focus:ring-[#6393C4]/10 transition-all"
    />
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-stone-50 dark:bg-[#2E3B4B]/40 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-white outline-none focus:border-[#6393C4]/50 focus:ring-2 focus:ring-[#6393C4]/10 transition-all"
    >
      {children}
    </select>
  );
}

function RadioCard<T extends string>({ value, current, onChange, label, desc }: { value: T; current: T; onChange: (v: T) => void; label: string; desc: string }) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={cn(
        'w-full text-left px-4 py-3 rounded-xl border transition-all',
        active
          ? 'border-[#6393C4] bg-[#6393C4]/5 dark:bg-[#6393C4]/8'
          : 'border-stone-200 dark:border-white/10 hover:border-stone-300 dark:hover:border-white/20 bg-stone-50 dark:bg-[#2E3B4B]/30',
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn('w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center', active ? 'border-[#6393C4]' : 'border-stone-300 dark:border-white/25')}>
          {active && <div className="w-2 h-2 rounded-full bg-[#6393C4]" />}
        </div>
        <div>
          <p className={cn('text-sm font-semibold', active ? 'text-[#6393C4]' : 'text-stone-700 dark:text-white/80')}>{label}</p>
          <p className="text-[11px] text-stone-400 dark:text-white/35">{desc}</p>
        </div>
      </div>
    </button>
  );
}

// ── Steps ─────────────────────────────────────────────────────────────────────

function Step1({ form, set }: { form: WizardForm; set: (k: keyof WizardForm, v: string) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Cooperative Name" required>
        <Input value={form.name} onChange={(v) => set('name', v)} placeholder="e.g. Community Savers Cooperative" />
      </Field>
      <Field label="Description" required>
        <textarea
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="What is the purpose of this cooperative?"
          rows={3}
          className="w-full bg-stone-50 dark:bg-[#2E3B4B]/40 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-white placeholder:text-stone-400 dark:placeholder:text-white/25 outline-none focus:border-[#6393C4]/50 focus:ring-2 focus:ring-[#6393C4]/10 transition-all resize-none"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Country" required>
          <Select value={form.country} onChange={(v) => set('country', v)}>
            <option value="">Select country</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Currency" required>
          <Select value={form.currency} onChange={(v) => set('currency', v)}>
            {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Cooperative Type" required>
        <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto pr-1">
          {COOP_TYPES.map((t) => (
            <RadioCard key={t.value} value={t.value} current={form.type} onChange={(v) => set('type', v)} label={t.label} desc={t.desc} />
          ))}
        </div>
      </Field>
    </div>
  );
}

function Step2({ form, set }: { form: WizardForm; set: (k: keyof WizardForm, v: string) => void }) {
  const freqs: { value: ContributionFrequency; label: string; desc: string }[] = [
    { value: 'weekly', label: 'Weekly', desc: 'Contributions every week' },
    { value: 'bi-weekly', label: 'Bi-Weekly', desc: 'Every two weeks' },
    { value: 'monthly', label: 'Monthly', desc: 'Once a month' },
  ];
  const privacyOpts: { value: CoopPrivacy; label: string; desc: string }[] = [
    { value: 'public', label: 'Public', desc: 'Anyone can find and request to join' },
    { value: 'private', label: 'Private', desc: 'Hidden from search, admin-approved only' },
    { value: 'invite-only', label: 'Invite Only', desc: 'Members join via invite code or link' },
  ];
  return (
    <div className="space-y-5">
      <Field
        label="Contribution Frequency"
        required
        hint="Members contribute once per period. On-chain vault enforces the same schedule."
      >
        <div className="space-y-2">
          {freqs.map((f) => (
            <RadioCard
              key={f.value}
              value={f.value}
              current={form.contributionFrequency}
              onChange={(v) => set('contributionFrequency', v)}
              label={f.label}
              desc={f.desc}
            />
          ))}
        </div>
      </Field>
      <Field
        label={`Contribution Amount (${form.currency})`}
        required
        hint={`Platform minimum is $${MIN_CONTRIBUTION_USDC}. This exact amount is what each member must deposit per cycle on Arc (not more, not less).`}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25">
              Min ${MIN_CONTRIBUTION_USDC} {form.currency}
            </span>
            <span className="text-[11px] text-stone-400 dark:text-white/35">
              Fixed per cycle · splits 60% / 30% / 5% / 5% on-chain
            </span>
          </div>
          <Input
            value={form.contributionAmount}
            onChange={(v) => set('contributionAmount', v)}
            type="number"
            min={MIN_CONTRIBUTION_USDC}
            step="1"
            placeholder={`e.g. ${MIN_CONTRIBUTION_USDC} or 50`}
          />
          {form.contributionAmount !== '' &&
            !Number.isNaN(Number(form.contributionAmount)) &&
            Number(form.contributionAmount) > 0 &&
            Number(form.contributionAmount) < MIN_CONTRIBUTION_USDC && (
              <p className="text-xs text-red-500">
                Amount must be at least ${MIN_CONTRIBUTION_USDC}. The platform and vault reject lower
                contributions.
              </p>
            )}
        </div>
      </Field>
      <Field label="Maximum Members" hint="Leave blank for unlimited">
        <Input value={form.maxMembers} onChange={(v) => set('maxMembers', v)} type="number" placeholder="e.g. 30" />
      </Field>
      <Field
        label="Payout Strategy"
        required
        hint="Only Join Order is available for MVP. Other strategies are prepared for a later release."
      >
        <div className="space-y-2">
          {ROTATION_OPTIONS.map((mode) => {
            const implemented = isRotationModeImplemented(mode);
            const active = form.rotationMode === mode;
            return (
              <button
                key={mode}
                type="button"
                disabled={!implemented}
                onClick={() => implemented && set('rotationMode', mode)}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-xl border transition-all',
                  active
                    ? 'border-[#6393C4] bg-[#6393C4]/5 dark:bg-[#6393C4]/8'
                    : implemented
                      ? 'border-stone-200 dark:border-white/10 hover:border-stone-300 dark:hover:border-white/20 bg-stone-50 dark:bg-[#2E3B4B]/30'
                      : 'border-stone-100 dark:border-white/5 bg-stone-50/60 dark:bg-[#2E3B4B]/15 opacity-70 cursor-not-allowed',
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
                    active ? 'border-[#6393C4]' : 'border-stone-300 dark:border-white/25',
                  )}>
                    {active && <div className="w-2 h-2 rounded-full bg-[#6393C4]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn('text-sm font-semibold', active ? 'text-[#6393C4]' : 'text-stone-700 dark:text-white/80')}>
                        {ROTATION_MODE_LABELS[mode]}
                        {mode === 'JOIN_ORDER' ? ' (Recommended)' : ''}
                      </p>
                      {!implemented && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-stone-200/80 dark:bg-white/10 text-stone-500 dark:text-white/40">
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-400 dark:text-white/35 mt-0.5">
                      {ROTATION_MODE_DESCRIPTIONS[mode]}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Privacy" required>
        <div className="space-y-2">
          {privacyOpts.map((p) => <RadioCard key={p.value} value={p.value} current={form.privacy} onChange={(v) => set('privacy', v)} label={p.label} desc={p.desc} />)}
        </div>
      </Field>
    </div>
  );
}

function Step3({ form, set, setNum }: { form: WizardForm; set: (k: keyof WizardForm, v: string) => void; setNum: (k: keyof WizardForm, v: number) => void }) {
  return (
    <div className="space-y-5">
      <Field label="Voting Model" required>
        <div className="space-y-2">
          {VOTING_MODELS.map((m) => <RadioCard key={m.value} value={m.value} current={form.votingModel} onChange={(v) => set('votingModel', v)} label={m.label} desc={m.desc} />)}
        </div>
      </Field>
      <Field label={`Approval Threshold — ${form.approvalThreshold}%`} hint="Percentage of votes required to pass a proposal">
        <input
          type="range" min={50} max={100} step={1} value={form.approvalThreshold}
          onChange={(e) => setNum('approvalThreshold', Number(e.target.value))}
          className="w-full h-2 bg-stone-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#6393C4]"
        />
        <div className="flex justify-between text-[10px] text-stone-400 dark:text-white/30 mt-1">
          <span>50%</span><span>75%</span><span>100%</span>
        </div>
      </Field>
      <Field label="Loan Approval Policy" required>
        <div className="space-y-2">
          {LOAN_POLICIES.map((p) => <RadioCard key={p.value} value={p.value} current={form.loanApprovalPolicy} onChange={(v) => set('loanApprovalPolicy', v)} label={p.label} desc={p.desc} />)}
        </div>
      </Field>
      <Field label="AI Governance Assistance">
        <button
          type="button"
          onClick={() => set('aiGovernanceEnabled', String(!form.aiGovernanceEnabled))}
          className={cn(
            'flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-all',
            form.aiGovernanceEnabled
              ? 'border-[#6393C4] bg-[#6393C4]/5 dark:bg-[#6393C4]/8'
              : 'border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-[#2E3B4B]/30',
          )}
        >
          <Sparkles className={cn('w-4 h-4', form.aiGovernanceEnabled ? 'text-[#6393C4]' : 'text-stone-400')} />
          <div className="flex-1 text-left">
            <p className={cn('text-sm font-semibold', form.aiGovernanceEnabled ? 'text-[#6393C4]' : 'text-stone-600 dark:text-white/60')}>Nexa AI Assistance</p>
            <p className="text-[11px] text-stone-400 dark:text-white/35">AI-powered insights, risk assessment, and governance recommendations</p>
          </div>
          <div className={cn('w-10 h-6 rounded-full transition-all flex items-center px-0.5', form.aiGovernanceEnabled ? 'bg-[#6393C4]' : 'bg-stone-200 dark:bg-white/10')}>
            <div className={cn('w-5 h-5 rounded-full bg-white shadow-sm transition-all', form.aiGovernanceEnabled ? 'translate-x-4' : 'translate-x-0')} />
          </div>
        </button>
      </Field>
    </div>
  );
}

function Step4({ form, preview, identity }: { form: WizardForm; preview: { inviteCode: string; cooperativeId: string }; identity: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const inviteLink = getInviteLink(preview.inviteCode);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const initials = form.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'CO';

  return (
    <div className="space-y-5">
      {/* Cooperative preview */}
      <div className="bg-gradient-to-r from-[#6393C4] to-[#77A6DB] rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-sm">{initials}</div>
          <div>
            <h3 className="font-display font-bold">{form.name}</h3>
            <p className="text-white/70 text-xs">{form.type} · {form.country} · {form.currency}</p>
          </div>
        </div>
        <p className="text-white/80 text-xs leading-relaxed line-clamp-2">{form.description}</p>
      </div>

      {/* Generated identity */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-stone-50 dark:bg-[#2E3B4B]/35 rounded-xl p-4">
          <p className="text-[10px] font-semibold text-stone-400 dark:text-white/30 uppercase tracking-wider mb-2">Cooperative ID</p>
          <p className="font-mono text-sm font-bold text-stone-800 dark:text-white tracking-widest">{preview.cooperativeId}</p>
          <button onClick={() => copy(preview.cooperativeId, 'id')} className="mt-2 flex items-center gap-1 text-[10px] text-stone-400 dark:text-white/30 hover:text-[#6393C4] transition-colors">
            <Copy className="w-3 h-3" />{copied === 'id' ? 'Copied!' : 'Copy ID'}
          </button>
        </div>
        <div className="bg-stone-50 dark:bg-[#2E3B4B]/35 rounded-xl p-4">
          <p className="text-[10px] font-semibold text-stone-400 dark:text-white/30 uppercase tracking-wider mb-2">Invite Code</p>
          <p className="font-mono text-sm font-bold text-stone-800 dark:text-white tracking-widest">{preview.inviteCode}</p>
          <button onClick={() => copy(preview.inviteCode, 'code')} className="mt-2 flex items-center gap-1 text-[10px] text-stone-400 dark:text-white/30 hover:text-[#6393C4] transition-colors">
            <Copy className="w-3 h-3" />{copied === 'code' ? 'Copied!' : 'Copy Code'}
          </button>
        </div>
      </div>

      {/* QR Code */}
      <div className="bg-stone-50 dark:bg-[#2E3B4B]/35 rounded-xl p-4 flex items-center gap-5">
        <div className="bg-white rounded-xl p-2 flex-shrink-0">
          <QRCodeSVG value={inviteLink} size={100} fgColor="#1c1917" bgColor="transparent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-stone-700 dark:text-white/80 mb-1">Invitation QR Code</p>
          <p className="text-[11px] text-stone-400 dark:text-white/35 mb-2">Share this QR code to invite new members instantly.</p>
          <p className="font-mono text-[10px] text-stone-500 dark:text-white/40 break-all truncate">{inviteLink}</p>
          <button onClick={() => copy(inviteLink, 'link')} className="mt-1.5 flex items-center gap-1 text-[10px] text-[#6393C4] hover:underline">
            <Copy className="w-3 h-3" />{copied === 'link' ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* Wallet association */}
      <div className="bg-stone-50 dark:bg-[#2E3B4B]/35 rounded-xl p-4">
        <p className="text-[10px] font-semibold text-stone-400 dark:text-white/30 uppercase tracking-wider mb-2">Founder Wallet Identity</p>
        <p className="font-mono text-xs text-stone-600 dark:text-white/60 break-all leading-relaxed">
          {identity || 'Not signed in — sign in with email to associate identity'}
        </p>
        {identity && (
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] text-emerald-500 font-semibold">Verified on Unicity Network</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Wizard ────────────────────────────────────────────────────────────────────

export function CreateWizard({ onClose }: { onClose: () => void }) {
  const { createCooperative } = useCooperative();
  const { identity } = useWallet();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [form, setForm] = useState<WizardForm>(DEFAULTS);
  const [preview] = useState(() => ({
    inviteCode: generateInviteCode(),
    cooperativeId: generateCoopId(),
  }));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const set = useCallback((k: keyof WizardForm, v: string) => {
    setForm((f) => ({ ...f, [k]: k === 'aiGovernanceEnabled' ? v === 'true' : v }));
  }, []);
  const setNum = useCallback((k: keyof WizardForm, v: number) => {
    setForm((f) => ({ ...f, [k]: v }));
  }, []);

  const validate = (): string => {
    if (step === 1) {
      if (!form.name.trim()) return 'Cooperative name is required.';
      if (!form.description.trim()) return 'Description is required.';
      if (!form.country) return 'Please select a country.';
    }
    if (step === 2) {
      const amt = Number(form.contributionAmount);
      if (!form.contributionAmount || isNaN(amt) || amt <= 0) {
        return 'Please enter a valid contribution amount.';
      }
      if (amt < MIN_CONTRIBUTION_USDC) {
        return `Contribution must be at least $${MIN_CONTRIBUTION_USDC} (platform & on-chain vault minimum).`;
      }
    }
    return '';
  };

  const next = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setStep((s) => Math.min(s + 1, 4) as 1 | 2 | 3 | 4);
  };

  const back = () => {
    setError('');
    setStep((s) => Math.max(s - 1, 1) as 1 | 2 | 3 | 4);
  };

  const launch = async () => {
    setCreating(true);
    try {
      await createCooperative({
        name: form.name,
        description: form.description,
        country: form.country,
        currency: form.currency,
        type: form.type,
        contributionFrequency: form.contributionFrequency,
        contributionAmount: Number(form.contributionAmount),
        maxMembers: form.maxMembers ? Number(form.maxMembers) : undefined,
        privacy: form.privacy,
        rotationMode: form.rotationMode,
        status: 'open',
        votingModel: form.votingModel,
        approvalThreshold: form.approvalThreshold,
        loanApprovalPolicy: form.loanApprovalPolicy,
        aiGovernanceEnabled: Boolean(form.aiGovernanceEnabled),
        inviteCode: preview.inviteCode,
        cooperativeId: preview.cooperativeId,
      }, identity?.walletAddress ?? '');
      onClose();
    } catch {
      setError('Failed to create cooperative. Please try again.');
      setCreating(false);
    }
  };

  const STEP_TITLES = ['Basic Information', 'Rules & Structure', 'Governance Model', 'Identity & Invitation'];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        className="relative w-full sm:max-w-lg h-[100dvh] sm:h-auto sm:max-h-[90vh] bg-white dark:bg-[#081827] border-0 sm:border border-stone-200 dark:border-[#1A2A3A] rounded-none sm:rounded-2xl flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-stone-100 dark:border-[#1A2A3A] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#6393C4]/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-[#6393C4]" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-stone-900 dark:text-white text-sm">Create Cooperative</h2>
              <p className="text-[11px] text-stone-400 dark:text-white/35 truncate">{STEP_TITLES[step - 1]}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-stone-400 dark:text-white/30 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
          <StepIndicator step={step} />
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
              {step === 1 && <Step1 form={form} set={set} />}
              {step === 2 && <Step2 form={form} set={set} />}
              {step === 3 && <Step3 form={form} set={set} setNum={setNum} />}
              {step === 4 && <Step4 form={form} preview={preview} identity={identity?.walletAddress ?? ''} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 pt-4 border-t border-stone-100 dark:border-[#1A2A3A] flex-shrink-0">
          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
          <div className="flex gap-3">
            {step > 1 && (
              <button onClick={back} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-stone-200 dark:border-white/10 text-stone-600 dark:text-white/60 text-sm font-semibold hover:bg-stone-50 dark:hover:bg-[#2E3B4B]/50 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            <button
              onClick={step === 4 ? launch : next}
              disabled={creating}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#6393C4] text-white text-sm font-semibold hover:bg-[#5289B8] disabled:opacity-60 transition-colors"
            >
              {creating ? (
                'Launching…'
              ) : step === 4 ? (
                <>
                  <span className="sm:hidden">Launch</span>
                  <span className="hidden sm:inline">Launch Cooperative</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

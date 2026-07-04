/**
 * CooperativeProvider — React context for multi-cooperative workspace management.
 * Persists to localStorage; architecture is ready for Unicity on-chain integration.
 */

import {
  createContext, useContext, useState, useEffect, useCallback, type ReactNode,
} from 'react';
import type { Cooperative } from '@/types';
import type { CoopCreateInput, JoinResult } from '@/services/cooperative/types';
import {
  loadCooperatives, saveCooperatives,
  createCooperative as svcCreate,
  updateCooperative as svcUpdate,
  findByInviteCode,
} from '@/services/cooperative/cooperative';
import { addMember, loadCoopMembers, saveCoopMembers, getMemberByWallet } from '@/services/cooperative/members';
import { getActiveCooperativeId, setActiveCooperativeId } from '@/services/cooperative/workspace';
import { DEMO_COOPERATIVE, DEMO_MEMBERS } from '@/lib/demo-data';

// ── Seed demo data on first run ───────────────────────────────────────────────

function seedDemoData(): void {
  if (loadCooperatives().length > 0) return;
  const seeded: Cooperative = {
    ...DEMO_COOPERATIVE,
    inviteCode: 'SSC-A2B-3C4',
    cooperativeId: 'SSCOOPA1',
    privacy: 'invite-only',
    votingModel: 'simple-majority',
    approvalThreshold: 60,
    loanApprovalPolicy: 'hybrid',
    aiGovernanceEnabled: true,
    founderWalletIdentity: DEMO_COOPERATIVE.walletIdentity,
  };
  saveCooperatives([seeded]);
  saveCoopMembers(DEMO_COOPERATIVE.id, DEMO_MEMBERS);
}

// ── Context ───────────────────────────────────────────────────────────────────

export interface CooperativeContextValue {
  cooperatives: Cooperative[];
  activeCooperative: Cooperative | null;
  setActiveCooperative: (id: string) => void;
  createCooperative: (input: CoopCreateInput, walletIdentity: string) => Cooperative;
  joinCooperative: (inviteCode: string, walletIdentity?: string) => JoinResult;
  updateCooperative: (id: string, updates: Partial<Cooperative>) => void;
  refresh: () => void;
}

const CooperativeContext = createContext<CooperativeContextValue | null>(null);

export function CooperativeProvider({ children }: { children: ReactNode }) {
  const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(() => {
    seedDemoData();
    const coops = loadCooperatives();
    setCooperatives(coops);
    const saved = getActiveCooperativeId();
    const valid = coops.find((c) => c.id === saved) ? saved : (coops[0]?.id ?? null);
    setActiveId(valid);
    if (valid) setActiveCooperativeId(valid);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setActiveCooperative = useCallback((id: string) => {
    setActiveId(id);
    setActiveCooperativeId(id);
  }, []);

  const createCooperativeCtx = useCallback(
    (input: CoopCreateInput, walletIdentity: string): Cooperative => {
      const coop = svcCreate(input, walletIdentity);
      // Founder automatically becomes the first member
      addMember(coop.id, {
        name: 'You (Founder)',
        email: '',
        avatar: '',
        initials: walletIdentity.slice(-4).toUpperCase() || 'ME',
        walletIdentity,
        role: 'founder',
        contributionScore: 100,
        riskScore: 0,
        reputation: 5,
        status: 'active',
        joinedAt: new Date().toISOString().split('T')[0],
        totalContributed: 0,
        missedContributions: 0,
        activeLoans: 0,
      });
      setCooperatives(loadCooperatives());
      setActiveCooperative(coop.id);
      return coop;
    },
    [setActiveCooperative],
  );

  const joinCooperative = useCallback(
    (inviteCode: string, walletIdentity = ''): JoinResult => {
      const coop = findByInviteCode(inviteCode);
      if (!coop) {
        return { ok: false, error: 'Invalid invite code. Please check and try again.' };
      }
      // Check if the current user wallet is already a member of this cooperative.
      if (walletIdentity) {
        const existingMember = getMemberByWallet(coop.id, walletIdentity);
        if (existingMember) {
          return { ok: false, error: 'You are already a member of this cooperative.' };
        }
      }
      // In a real integration, this would send a join request via Sphere Messaging
      // and verify the Unicity wallet identity on-chain before admitting the member.
      // For now, add the requester as a member and switch to this cooperative.
      if (walletIdentity) {
        addMember(coop.id, {
          name: 'You',
          email: '',
          avatar: '',
          initials: walletIdentity.slice(-4).toUpperCase() || 'ME',
          walletIdentity,
          role: 'member',
          contributionScore: 100,
          riskScore: 0,
          reputation: 3,
          status: 'active',
          joinedAt: new Date().toISOString().split('T')[0],
          totalContributed: 0,
          missedContributions: 0,
          activeLoans: 0,
        });
        const newCount = loadCoopMembers(coop.id).length;
        svcUpdate(coop.id, { memberCount: newCount });
      }
      setActiveCooperative(coop.id);
      setCooperatives(loadCooperatives());
      return { ok: true, coop };
    },
    [setActiveCooperative],
  );

  const updateCooperativeCtx = useCallback(
    (id: string, updates: Partial<Cooperative>) => {
      svcUpdate(id, updates);
      setCooperatives(loadCooperatives());
    },
    [],
  );

  const activeCooperative = cooperatives.find((c) => c.id === activeId) ?? null;

  return (
    <CooperativeContext.Provider
      value={{
        cooperatives,
        activeCooperative,
        setActiveCooperative,
        createCooperative: createCooperativeCtx,
        joinCooperative,
        updateCooperative: updateCooperativeCtx,
        refresh: load,
      }}
    >
      {children}
    </CooperativeContext.Provider>
  );
}

export function useCooperative(): CooperativeContextValue {
  const ctx = useContext(CooperativeContext);
  if (!ctx) throw new Error('useCooperative must be used inside <CooperativeProvider>');
  return ctx;
}

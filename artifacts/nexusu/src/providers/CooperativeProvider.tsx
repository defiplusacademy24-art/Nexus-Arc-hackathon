/**
 * CooperativeProvider — React context for multi-cooperative workspace management.
 * Persists to localStorage; architecture is ready for Arc / Circle / AI integrations.
 */

import {
  createContext, useContext, useState, useEffect, useCallback, type ReactNode,
} from 'react';
import type { Cooperative } from '@/types';
import type { CoopCreateInput, JoinResult, MemberRegistrationInput } from '@/services/cooperative/types';
import {
  loadCooperatives, saveCooperatives,
  createCooperative as svcCreate,
  updateCooperative as svcUpdate,
  findByInviteCode,
  activateCooperative as svcActivate,
  maybeAutoActivate,
} from '@/services/cooperative/cooperative';
import {
  createFounderMember,
  getMemberByWallet,
  loadCoopMembers,
  registerMember,
  saveCoopMembers,
  addMember,
} from '@/services/cooperative/members';
import { getActiveCooperativeId, setActiveCooperativeId } from '@/services/cooperative/workspace';
import { joinErrorMessage } from '@/services/cooperative/validation';
import { normaliseRotationMode } from '@/services/cooperative/rotation';
import {
  apiCreateCooperative,
  apiJoinCooperative,
  apiActivateCooperative,
} from '@/services/notifications/api';

/** Known mock / seed cooperative identifiers from earlier demos. */
const DEMO_COOP_IDS = new Set(['coop-001']);
const DEMO_INVITE_CODES = new Set(['SSC-A2B-3C4']);
const DEMO_COOP_NAMES = new Set(['sunshine savings cooperative']);

/**
 * One-time cleanup: drop the seeded "Sunshine Savings" mock cooperative and
 * its members so the app only shows real user-created/joined workspaces.
 */
function purgeDemoCooperatives(): void {
  try {
    const coops = loadCooperatives();
    if (coops.length === 0) return;

    const isDemo = (c: Cooperative) =>
      DEMO_COOP_IDS.has(c.id) ||
      (c.inviteCode != null && DEMO_INVITE_CODES.has(c.inviteCode.toUpperCase())) ||
      DEMO_COOP_NAMES.has((c.name ?? '').trim().toLowerCase());

    const kept = coops.filter((c) => !isDemo(c));
    if (kept.length === coops.length) return;

    for (const c of coops.filter(isDemo)) {
      try {
        localStorage.removeItem(`nexusu:members:${c.id}`);
      } catch {
        /* ignore */
      }
    }
    saveCooperatives(kept);

    const active = getActiveCooperativeId();
    if (active && !kept.some((c) => c.id === active)) {
      if (kept[0]) setActiveCooperativeId(kept[0].id);
      else localStorage.removeItem('nexusu:active-coop');
    }
  } catch {
    /* ignore purge errors */
  }
}

function mapRemoteCoop(
  remote: Record<string, unknown>,
  fallbackWallet: string,
  inviteCode?: string,
): Cooperative {
  return {
    id: String(remote.id),
    name: String(remote.name),
    type: (remote.type as Cooperative['type']) ?? 'General',
    country: String(remote.country ?? ''),
    currency: String(remote.currency ?? 'USD'),
    memberCount: Number(remote.memberCount ?? 1),
    treasuryBalance: Number(remote.treasuryBalance ?? 0),
    contributionAmount: Number(remote.contributionAmount ?? 0),
    contributionFrequency:
      (remote.contributionFrequency as Cooperative['contributionFrequency']) ?? 'monthly',
    walletIdentity: String(remote.walletIdentity ?? fallbackWallet),
    status: (remote.status as Cooperative['status']) ?? 'open',
    governanceScore: Number(remote.governanceScore ?? 0),
    aiHealthScore: Number(remote.aiHealthScore ?? 0),
    createdAt: String(remote.createdAt ?? new Date().toISOString().split('T')[0]),
    description: String(remote.description ?? ''),
    inviteCode: String(remote.inviteCode ?? inviteCode ?? ''),
    founderWalletIdentity: String(remote.founderWalletIdentity ?? ''),
    maxMembers: remote.maxMembers != null ? Number(remote.maxMembers) : undefined,
    rotationMode: normaliseRotationMode(
      remote.rotationMode != null ? String(remote.rotationMode) : undefined,
    ),
    currentRecipientPosition: Number(remote.currentRecipientPosition ?? 1),
    currentCycle: Number(remote.currentCycle ?? 1),
    privacy: remote.privacy as Cooperative['privacy'],
    votingModel: remote.votingModel as Cooperative['votingModel'],
    approvalThreshold:
      remote.approvalThreshold != null ? Number(remote.approvalThreshold) : undefined,
    loanApprovalPolicy: remote.loanApprovalPolicy as Cooperative['loanApprovalPolicy'],
    aiGovernanceEnabled:
      remote.aiGovernanceEnabled != null
        ? Boolean(remote.aiGovernanceEnabled)
        : undefined,
  };
}

// ── Context ───────────────────────────────────────────────────────────────────

export interface CooperativeContextValue {
  cooperatives: Cooperative[];
  activeCooperative: Cooperative | null;
  setActiveCooperative: (id: string) => void;
  createCooperative: (input: CoopCreateInput, walletIdentity: string) => Cooperative;
  joinCooperative: (
    inviteCode: string,
    walletIdentity?: string,
    registration?: Partial<MemberRegistrationInput>,
  ) => JoinResult | Promise<JoinResult>;
  activateCooperative: (id: string, walletIdentity?: string) => Promise<Cooperative>;
  updateCooperative: (id: string, updates: Partial<Cooperative>) => void;
  refresh: () => void;
}

const CooperativeContext = createContext<CooperativeContextValue | null>(null);

export function CooperativeProvider({ children }: { children: ReactNode }) {
  const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(() => {
    try {
      purgeDemoCooperatives();
      const coops = loadCooperatives();
      setCooperatives(coops);
      const saved = getActiveCooperativeId();
      const valid = coops.find((c) => c.id === saved) ? saved : (coops[0]?.id ?? null);
      setActiveId(valid);
      if (valid) setActiveCooperativeId(valid);
      else localStorage.removeItem('nexusu:active-coop');
    } catch (err) {
      console.error('[Nexusu] Failed to load cooperatives:', err);
      setCooperatives([]);
      setActiveId(null);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setActiveCooperative = useCallback((id: string) => {
    setActiveId(id);
    setActiveCooperativeId(id);
  }, []);

  const createCooperativeCtx = useCallback(
    (input: CoopCreateInput, walletIdentity: string): Cooperative => {
      const coop = svcCreate(
        {
          ...input,
          status: input.status ?? 'open',
          rotationMode: input.rotationMode ?? 'JOIN_ORDER',
        },
        walletIdentity,
      );
      // Founder is permanent payout position #1
      createFounderMember(coop.id, walletIdentity, {
        displayName: 'You (Founder)',
      });
      setCooperatives(loadCooperatives());
      setActiveCooperative(coop.id);

      if (walletIdentity) {
        void apiCreateCooperative(walletIdentity, {
          name: input.name,
          description: input.description,
          type: input.type,
          country: input.country,
          currency: input.currency,
          contributionAmount: input.contributionAmount,
          contributionFrequency: input.contributionFrequency,
          privacy: input.privacy,
          votingModel: input.votingModel,
          approvalThreshold: input.approvalThreshold,
          loanApprovalPolicy: input.loanApprovalPolicy,
          aiGovernanceEnabled: input.aiGovernanceEnabled,
          maxMembers: input.maxMembers,
          inviteCode: coop.inviteCode,
          rotationMode: coop.rotationMode ?? 'JOIN_ORDER',
          status: coop.status,
          founderDisplayName: 'Founder',
        })
          .then((res) => {
            const backendId = res.cooperative?.id;
            if (backendId) {
              svcUpdate(coop.id, { backendId: String(backendId) });
              setCooperatives(loadCooperatives());
            }
          })
          .catch((err) => {
            console.warn('[Nexusu] Backend coop create failed (local still saved):', err);
          });
      }

      return coop;
    },
    [setActiveCooperative],
  );

  const joinCooperative = useCallback(
    async (
      inviteCode: string,
      walletIdentity = '',
      registration?: Partial<MemberRegistrationInput>,
    ): Promise<JoinResult> => {
      const displayName = registration?.displayName?.trim() || '';
      const email = registration?.email?.trim() || '';
      const wallet = (registration?.walletAddress || walletIdentity || '').trim();

      const coop = findByInviteCode(inviteCode);

      // Shared backend path when invite is not in local storage
      if (!coop) {
        if (!wallet) {
          return { ok: false, error: 'Connect a wallet before joining a cooperative.' };
        }
        try {
          const res = await apiJoinCooperative(wallet, inviteCode, {
            displayName: displayName || undefined,
            email: email || undefined,
          });
          const remote = res.cooperative as Record<string, unknown>;
          const mirrored = mapRemoteCoop(remote, wallet, inviteCode);
          const existing = loadCooperatives();
          if (!existing.some((c) => c.id === mirrored.id || c.inviteCode === mirrored.inviteCode)) {
            saveCooperatives([...existing, mirrored]);
          } else {
            // Refresh local mirror with remote memberCount/status
            const updated = existing.map((c) =>
              c.id === mirrored.id || c.inviteCode === mirrored.inviteCode
                ? { ...c, ...mirrored, id: c.id === mirrored.id ? c.id : mirrored.id }
                : c,
            );
            saveCooperatives(updated);
          }

          const joinPosition =
            res.joinPosition ??
            (res.member?.joinPosition as number | undefined) ??
            (loadCoopMembers(mirrored.id).length + 1);

          if (!getMemberByWallet(mirrored.id, wallet)) {
            const name = displayName || String(res.member?.name ?? 'You');
            const initials =
              name
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0] ?? '')
                .join('')
                .toUpperCase() ||
              wallet.slice(-4).toUpperCase() ||
              'ME';
            addMember(mirrored.id, {
              name,
              email: email || String(res.member?.email ?? ''),
              avatar: '',
              initials,
              walletIdentity: wallet,
              role: 'member',
              contributionScore: 100,
              riskScore: 0,
              reputation: 3,
              status: 'active',
              joinedAt: new Date().toISOString(),
              totalContributed: 0,
              missedContributions: 0,
              activeLoans: 0,
              joinPosition,
              contributionStatus: 'waiting',
              hasReceivedPayout: false,
              creditScore: 70,
            });
          }

          const finalCoop = loadCooperatives().find(
            (c) => c.id === mirrored.id || c.inviteCode === mirrored.inviteCode,
          ) ?? mirrored;
          maybeAutoActivate(finalCoop.id);
          setActiveCooperative(finalCoop.id);
          setCooperatives(loadCooperatives());
          const member = getMemberByWallet(finalCoop.id, wallet) ?? undefined;
          return {
            ok: true,
            coop: loadCooperatives().find((c) => c.id === finalCoop.id) ?? finalCoop,
            member,
            joinPosition: member?.joinPosition ?? joinPosition,
          };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : 'Invalid invite code. Please check and try again.',
          };
        }
      }

      // Local cooperative path
      try {
        if (!wallet) {
          return { ok: false, error: 'Connect a wallet before joining a cooperative.' };
        }

        const existingMember = getMemberByWallet(coop.id, wallet);
        if (existingMember) {
          return {
            ok: false,
            error: 'You are already a member of this cooperative.',
          };
        }

        const member = registerMember(coop, {
          walletAddress: wallet,
          email,
          displayName: displayName || 'You',
        });

        const newCount = loadCoopMembers(coop.id).length;
        svcUpdate(coop.id, { memberCount: newCount });
        maybeAutoActivate(coop.id);

        void apiJoinCooperative(wallet, inviteCode, {
          displayName: member.name,
          email: member.email || undefined,
        }).catch((err) => {
          console.warn('[Nexusu] Backend coop join failed (local still saved):', err);
        });

        setActiveCooperative(coop.id);
        setCooperatives(loadCooperatives());
        const updated = loadCooperatives().find((c) => c.id === coop.id) ?? coop;
        return {
          ok: true,
          coop: updated,
          member,
          joinPosition: member.joinPosition,
        };
      } catch (err) {
        return { ok: false, error: joinErrorMessage(err) };
      }
    },
    [setActiveCooperative],
  );

  const activateCooperativeCtx = useCallback(
    async (id: string, walletIdentity = ''): Promise<Cooperative> => {
      const coop = svcActivate(id);
      setCooperatives(loadCooperatives());
      if (walletIdentity) {
        try {
          const res = await apiActivateCooperative(walletIdentity, id);
          if (res.cooperative?.status) {
            svcUpdate(id, { status: res.cooperative.status as Cooperative['status'] });
            setCooperatives(loadCooperatives());
          }
        } catch (err) {
          console.warn('[Nexusu] Backend activate failed (local still updated):', err);
        }
      }
      return loadCooperatives().find((c) => c.id === id) ?? coop;
    },
    [],
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
        activateCooperative: activateCooperativeCtx,
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

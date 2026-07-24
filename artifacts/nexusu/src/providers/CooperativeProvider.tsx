/**
 * CooperativeProvider — multi-cooperative workspace management.
 *
 * Production path: API (Postgres when DATABASE_URL is set) is source of truth.
 * localStorage is a cache for offline UX and faster paint; rehydrated on wallet connect.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { Cooperative, Member } from '@/types';
import type { CoopCreateInput, JoinResult, MemberRegistrationInput } from '@/services/cooperative/types';
import {
  loadCooperatives,
  saveCooperatives,
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
  apiHydrateCooperatives,
} from '@/services/notifications/api';
import { useWallet } from '@/providers/WalletProvider';

/** Known mock / seed cooperative identifiers from earlier demos. */
const DEMO_COOP_IDS = new Set(['coop-001']);
const DEMO_INVITE_CODES = new Set(['SSC-A2B-3C4']);
const DEMO_COOP_NAMES = new Set(['sunshine savings cooperative']);

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
  const createdRaw = String(remote.createdAt ?? new Date().toISOString());
  const createdAt = createdRaw.includes('T')
    ? createdRaw.split('T')[0]
    : createdRaw;

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
    createdAt,
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
    backendId: String(remote.id),
  };
}

function mapRemoteMember(raw: Record<string, unknown>, walletFallback = ''): Member {
  const name = String(raw.displayName ?? raw.name ?? 'Member');
  const wallet = String(raw.walletIdentity ?? walletFallback);
  const initials =
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase() ||
    wallet.slice(-4).toUpperCase() ||
    'ME';

  return {
    id: String(raw.id),
    name,
    email: String(raw.email ?? ''),
    avatar: '',
    initials,
    walletIdentity: wallet,
    role: (raw.role as Member['role']) ?? 'member',
    contributionScore: 100,
    riskScore: 0,
    reputation: 3,
    status: (raw.status as Member['status']) ?? 'active',
    joinedAt: String(raw.joinedAt ?? new Date().toISOString()),
    totalContributed: Number(raw.totalContributed ?? 0),
    missedContributions: 0,
    activeLoans: 0,
    joinPosition:
      raw.joinPosition != null ? Number(raw.joinPosition) : undefined,
    contributionStatus:
      (raw.contributionStatus as Member['contributionStatus']) ?? 'waiting',
    hasReceivedPayout: Boolean(raw.hasReceivedPayout ?? false),
    creditScore: raw.creditScore != null ? Number(raw.creditScore) : 70,
  };
}

function applyHydrateToCache(
  wallet: string,
  cooperatives: Array<Record<string, unknown>>,
  membersByCoop: Record<string, Array<Record<string, unknown>>>,
): Cooperative[] {
  const mapped = cooperatives.map((r) => mapRemoteCoop(r, wallet));
  saveCooperatives(mapped);

  for (const coop of mapped) {
    const remoteMembers = membersByCoop[coop.id] ?? [];
    const members = remoteMembers.map((m) => mapRemoteMember(m));
    saveCoopMembers(coop.id, members);
  }

  // Drop orphan member caches for coops no longer on the server
  const ids = new Set(mapped.map((c) => c.id));
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('nexusu:members:')) continue;
      const coopId = key.slice('nexusu:members:'.length);
      if (!ids.has(coopId)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }

  return mapped;
}

// ── Context ───────────────────────────────────────────────────────────────────

export interface CooperativeContextValue {
  cooperatives: Cooperative[];
  activeCooperative: Cooperative | null;
  setActiveCooperative: (id: string) => void;
  createCooperative: (
    input: CoopCreateInput,
    walletIdentity: string,
  ) => Cooperative | Promise<Cooperative>;
  joinCooperative: (
    inviteCode: string,
    walletIdentity?: string,
    registration?: Partial<MemberRegistrationInput>,
  ) => JoinResult | Promise<JoinResult>;
  activateCooperative: (id: string, walletIdentity?: string) => Promise<Cooperative>;
  updateCooperative: (id: string, updates: Partial<Cooperative>) => void;
  refresh: () => void;
  /** Re-fetch coops/members from the API for the connected wallet. */
  hydrateFromServer: (wallet: string) => Promise<void>;
  isHydrating: boolean;
  lastHydratedWallet: string | null;
}

const CooperativeContext = createContext<CooperativeContextValue | null>(null);

export function CooperativeProvider({ children }: { children: ReactNode }) {
  const { walletAddress, isConnected } = useWallet();
  const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(false);
  const [lastHydratedWallet, setLastHydratedWallet] = useState<string | null>(null);
  const hydratingRef = useRef(false);

  const applyCoopsToState = useCallback((coops: Cooperative[]) => {
    setCooperatives(coops);
    const saved = getActiveCooperativeId();
    const valid = coops.find((c) => c.id === saved) ? saved : (coops[0]?.id ?? null);
    setActiveId(valid);
    if (valid) setActiveCooperativeId(valid);
    else {
      try {
        localStorage.removeItem('nexusu:active-coop');
      } catch {
        /* ignore */
      }
    }
  }, []);

  const load = useCallback(() => {
    try {
      purgeDemoCooperatives();
      applyCoopsToState(loadCooperatives());
    } catch (err) {
      console.error('[Nexusu] Failed to load cooperatives:', err);
      setCooperatives([]);
      setActiveId(null);
    }
  }, [applyCoopsToState]);

  useEffect(() => {
    load();
  }, [load]);

  const hydrateFromServer = useCallback(
    async (wallet: string) => {
      if (!wallet || hydratingRef.current) return;
      hydratingRef.current = true;
      setIsHydrating(true);
      try {
        const data = await apiHydrateCooperatives(wallet);
        const mapped = applyHydrateToCache(
          wallet,
          data.cooperatives ?? [],
          data.membersByCoop ?? {},
        );
        applyCoopsToState(mapped);
        setLastHydratedWallet(wallet.toLowerCase());
        if (data.storage === 'file') {
          console.info(
            '[Nexusu] API storage is ephemeral file mode. Set DATABASE_URL for durable production data.',
          );
        }
      } catch (err) {
        console.warn('[Nexusu] Server hydrate failed — using local cache:', err);
        // Mark attempted so we don't infinite-retry on hard failures; call hydrateFromServer() to retry.
        setLastHydratedWallet(wallet.toLowerCase());
        load();
      } finally {
        hydratingRef.current = false;
        setIsHydrating(false);
      }
    },
    [applyCoopsToState, load],
  );

  // Rehydrate whenever the connected wallet changes
  useEffect(() => {
    if (!isConnected || !walletAddress) {
      if (!isConnected) setLastHydratedWallet(null);
      return;
    }
    const w = walletAddress.toLowerCase();
    if (lastHydratedWallet === w) return;
    void hydrateFromServer(walletAddress);
  }, [isConnected, walletAddress, hydrateFromServer, lastHydratedWallet]);

  const setActiveCooperative = useCallback((id: string) => {
    setActiveId(id);
    setActiveCooperativeId(id);
  }, []);

  const createCooperativeCtx = useCallback(
    async (input: CoopCreateInput, walletIdentity: string): Promise<Cooperative> => {
      // API-first when wallet is present (durable on Postgres)
      if (walletIdentity) {
        try {
          const res = await apiCreateCooperative(walletIdentity, {
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
            inviteCode: input.inviteCode,
            rotationMode: input.rotationMode ?? 'JOIN_ORDER',
            status: input.status ?? 'open',
            founderDisplayName: 'Founder',
          });
          const remote = res.cooperative as Record<string, unknown>;
          const coop = mapRemoteCoop(remote, walletIdentity);
          const existing = loadCooperatives().filter(
            (c) => c.id !== coop.id && c.inviteCode !== coop.inviteCode,
          );
          saveCooperatives([...existing, coop]);

          if (res.member) {
            saveCoopMembers(coop.id, [mapRemoteMember(res.member as Record<string, unknown>, walletIdentity)]);
          } else {
            createFounderMember(coop.id, walletIdentity, {
              displayName: 'You (Founder)',
            });
          }

          applyCoopsToState(loadCooperatives());
          setActiveCooperative(coop.id);
          return coop;
        } catch (err) {
          console.warn(
            '[Nexusu] Backend coop create failed — falling back to local only:',
            err,
          );
        }
      }

      // Offline / API-down fallback
      const coop = svcCreate(
        {
          ...input,
          status: input.status ?? 'open',
          rotationMode: input.rotationMode ?? 'JOIN_ORDER',
        },
        walletIdentity,
      );
      createFounderMember(coop.id, walletIdentity, {
        displayName: 'You (Founder)',
      });
      applyCoopsToState(loadCooperatives());
      setActiveCooperative(coop.id);
      return coop;
    },
    [setActiveCooperative, applyCoopsToState],
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

      if (!wallet) {
        return { ok: false, error: 'Connect a wallet before joining a cooperative.' };
      }

      // Always prefer server join (works even if invite is not in this browser's cache)
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
          const updated = existing.map((c) =>
            c.id === mirrored.id || c.inviteCode === mirrored.inviteCode
              ? { ...c, ...mirrored, id: mirrored.id }
              : c,
          );
          saveCooperatives(updated);
        }

        const joinPosition =
          res.joinPosition ??
          (res.member?.joinPosition as number | undefined) ??
          loadCoopMembers(mirrored.id).length + 1;

        if (res.member) {
          const mapped = mapRemoteMember(res.member as Record<string, unknown>, wallet);
          const members = loadCoopMembers(mirrored.id).filter(
            (m) => m.walletIdentity.toLowerCase() !== wallet.toLowerCase(),
          );
          saveCoopMembers(mirrored.id, [...members, mapped]);
        } else if (!getMemberByWallet(mirrored.id, wallet)) {
          const name = displayName || 'You';
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
            email: email || '',
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

        maybeAutoActivate(mirrored.id);
        setActiveCooperative(mirrored.id);
        applyCoopsToState(loadCooperatives());
        const member = getMemberByWallet(mirrored.id, wallet) ?? undefined;
        return {
          ok: true,
          coop: loadCooperatives().find((c) => c.id === mirrored.id) ?? mirrored,
          member,
          joinPosition: member?.joinPosition ?? joinPosition,
        };
      } catch (err) {
        // Fall back to local-only if the invite exists in this browser and server is down
        const local = findByInviteCode(inviteCode);
        if (!local) {
          return {
            ok: false,
            error:
              err instanceof Error
                ? err.message
                : 'Invalid invite code. Please check and try again.',
          };
        }
        try {
          const existingMember = getMemberByWallet(local.id, wallet);
          if (existingMember) {
            return {
              ok: false,
              error: 'You are already a member of this cooperative.',
            };
          }
          const member = registerMember(local, {
            walletAddress: wallet,
            email,
            displayName: displayName || 'You',
          });
          const newCount = loadCoopMembers(local.id).length;
          svcUpdate(local.id, { memberCount: newCount });
          maybeAutoActivate(local.id);
          setActiveCooperative(local.id);
          applyCoopsToState(loadCooperatives());
          return {
            ok: true,
            coop: loadCooperatives().find((c) => c.id === local.id) ?? local,
            member,
            joinPosition: member.joinPosition,
          };
        } catch (localErr) {
          return { ok: false, error: joinErrorMessage(localErr) };
        }
      }
    },
    [setActiveCooperative, applyCoopsToState],
  );

  const activateCooperativeCtx = useCallback(
    async (id: string, walletIdentity = ''): Promise<Cooperative> => {
      if (walletIdentity) {
        try {
          const res = await apiActivateCooperative(walletIdentity, id);
          if (res.cooperative?.status) {
            svcUpdate(id, {
              status: res.cooperative.status as Cooperative['status'],
            });
            applyCoopsToState(loadCooperatives());
            return loadCooperatives().find((c) => c.id === id)!;
          }
        } catch (err) {
          console.warn('[Nexusu] Backend activate failed (local still updated):', err);
        }
      }
      const coop = svcActivate(id);
      applyCoopsToState(loadCooperatives());
      return loadCooperatives().find((c) => c.id === id) ?? coop;
    },
    [applyCoopsToState],
  );

  const updateCooperativeCtx = useCallback(
    (id: string, updates: Partial<Cooperative>) => {
      svcUpdate(id, updates);
      applyCoopsToState(loadCooperatives());
    },
    [applyCoopsToState],
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
        hydrateFromServer,
        isHydrating,
        lastHydratedWallet,
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

/**
 * File-backed domain store (cooperatives, members, transactions, notifications).
 * Works without PostgreSQL — data lives in data/store.json under the api-server package.
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve a writable data directory.
 * - DATA_DIR env always wins
 * - On Vercel/serverless the filesystem is read-only except /tmp
 * - Locally: artifacts/api-server/data (works for both src and dist layouts)
 */
function resolveDataDir(): string {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "nexusu-data");
  }
  // Prefer package-local data/ next to package.json (works from src/lib or dist)
  return path.resolve(__dirname, "..", "..", "data");
}

const DATA_DIR = resolveDataDir();
const STORE_PATH = path.join(DATA_DIR, "store.json");

// ── Domain types ───────────────────────────────────────────────────────────────

export type NotifType =
  | "contribution"
  | "deposit"
  | "withdrawal"
  | "loan"
  | "proposal"
  | "vote"
  | "member"
  | "ai"
  | "treasury"
  | "warning";

export interface StoredNotification {
  id: string;
  recipientWallet: string;
  coopId: string | null;
  type: NotifType;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  actionLabel?: string;
  actionHref?: string;
  metadata?: Record<string, unknown>;
}

/** Payout rotation strategies. Only JOIN_ORDER is implemented for MVP. */
export type RotationMode =
  | "JOIN_ORDER"
  | "RANDOM"
  | "ORGANIZER_ASSIGNED"
  | "GOVERNANCE_VOTE";

export const DEFAULT_ROTATION_MODE: RotationMode = "JOIN_ORDER";

/** Cooperative lifecycle: draft → open → active → completed */
export type CoopLifecycleStatus = "draft" | "open" | "active" | "completed";

export type ContributionStatus =
  | "waiting"
  | "pending"
  | "paid"
  | "overdue"
  | "exempt";

export interface StoredCooperative {
  id: string;
  name: string;
  description: string;
  type: string;
  country: string;
  currency: string;
  memberCount: number;
  treasuryBalance: number;
  contributionAmount: number;
  contributionFrequency: string;
  walletIdentity: string;
  /** draft | open | active | completed (legacy values still read) */
  status: string;
  inviteCode: string;
  founderWalletIdentity: string;
  privacy?: string;
  votingModel?: string;
  approvalThreshold?: number;
  loanApprovalPolicy?: string;
  aiGovernanceEnabled?: boolean;
  maxMembers?: number;
  /** Payout strategy — default JOIN_ORDER */
  rotationMode?: RotationMode;
  /** Current cycle recipient join position (1-based) */
  currentRecipientPosition?: number;
  /** Contribution cycle counter (1-based) */
  currentCycle?: number;
  createdAt: string;
}

export interface StoredMember {
  id: string;
  coopId: string;
  walletIdentity: string;
  name: string;
  /** Display name used at registration */
  displayName?: string;
  email?: string;
  role: string;
  status: string;
  joinedAt: string;
  totalContributed: number;
  /** Permanent payout order position (1-based). Never reordered. */
  joinPosition?: number;
  contributionStatus?: ContributionStatus;
  hasReceivedPayout?: boolean;
  /** Placeholder for future AI lending agents */
  creditScore?: number;
}

export type TxType = "deposit" | "withdrawal" | "contribution";

export interface StoredTransaction {
  id: string;
  coopId: string;
  walletIdentity: string;
  type: TxType;
  amount: number;
  currency: string;
  note?: string;
  createdAt: string;
}

/** Deduped on-chain Arc USDC transfers (native or ERC-20). */
export interface StoredOnchainTransfer {
  id: string;
  key: string; // txHash:logIndex or txHash:native
  txHash: string;
  logIndex: number | null;
  wallet: string;
  direction: "in" | "out";
  amount: number;
  token: "usdc-erc20" | "usdc-native";
  counterparty: string;
  blockNumber: number;
  explorerUrl?: string;
  createdAt: string;
}

interface StoreData {
  cooperatives: StoredCooperative[];
  members: StoredMember[];
  transactions: StoredTransaction[];
  notifications: StoredNotification[];
  onchainTransfers: StoredOnchainTransfer[];
}

// ── Persistence ────────────────────────────────────────────────────────────────

function emptyStore(): StoreData {
  return {
    cooperatives: [],
    members: [],
    transactions: [],
    notifications: [],
    onchainTransfers: [],
  };
}

function load(): StoreData {
  try {
    if (!existsSync(STORE_PATH)) return emptyStore();
    const raw = readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    return {
      cooperatives: parsed.cooperatives ?? [],
      members: parsed.members ?? [],
      transactions: parsed.transactions ?? [],
      notifications: parsed.notifications ?? [],
      onchainTransfers: parsed.onchainTransfers ?? [],
    };
  } catch {
    return emptyStore();
  }
}

function save(data: StoreData): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
}

let cache: StoreData | null = null;

function getStore(): StoreData {
  if (!cache) cache = load();
  return cache;
}

function commit(data: StoreData): void {
  cache = data;
  save(data);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function shortWallet(w: string): string {
  if (w.length < 10) return w || "member";
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = (n: number) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join(
      "",
    );
  return `${part(3)}-${part(3)}-${part(3)}`;
}

// ── Notifications ──────────────────────────────────────────────────────────────

export function listNotifications(opts: {
  wallet: string;
  unreadOnly?: boolean;
  limit?: number;
}): StoredNotification[] {
  const wallet = opts.wallet.toLowerCase();
  let list = getStore().notifications.filter(
    (n) => n.recipientWallet.toLowerCase() === wallet,
  );
  if (opts.unreadOnly) list = list.filter((n) => !n.read);
  list = [...list].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  if (opts.limit && opts.limit > 0) list = list.slice(0, opts.limit);
  return list;
}

export function unreadCount(wallet: string): number {
  const w = wallet.toLowerCase();
  return getStore().notifications.filter(
    (n) => n.recipientWallet.toLowerCase() === w && !n.read,
  ).length;
}

export function markNotificationRead(id: string, wallet: string): StoredNotification | null {
  const data = getStore();
  const w = wallet.toLowerCase();
  const idx = data.notifications.findIndex(
    (n) => n.id === id && n.recipientWallet.toLowerCase() === w,
  );
  if (idx === -1) return null;
  data.notifications[idx] = { ...data.notifications[idx], read: true };
  commit(data);
  return data.notifications[idx];
}

export function markAllNotificationsRead(wallet: string): number {
  const data = getStore();
  const w = wallet.toLowerCase();
  let count = 0;
  data.notifications = data.notifications.map((n) => {
    if (n.recipientWallet.toLowerCase() === w && !n.read) {
      count += 1;
      return { ...n, read: true };
    }
    return n;
  });
  commit(data);
  return count;
}

export type CreateNotificationInput = {
  recipientWallet: string;
  coopId?: string | null;
  type: NotifType;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  metadata?: Record<string, unknown>;
};

export function createNotification(input: CreateNotificationInput): StoredNotification {
  const data = getStore();
  const notif: StoredNotification = {
    id: `notif-${randomUUID()}`,
    recipientWallet: input.recipientWallet,
    coopId: input.coopId ?? null,
    type: input.type,
    title: input.title,
    description: input.description,
    timestamp: new Date().toISOString(),
    read: false,
    actionLabel: input.actionLabel,
    actionHref: input.actionHref,
    metadata: input.metadata,
  };
  data.notifications.unshift(notif);
  // Cap growth
  if (data.notifications.length > 5000) {
    data.notifications = data.notifications.slice(0, 5000);
  }
  commit(data);
  return notif;
}

export function createNotifications(
  inputs: CreateNotificationInput[],
): StoredNotification[] {
  return inputs.map((i) => createNotification(i));
}

// ── Cooperatives ───────────────────────────────────────────────────────────────

export function listCooperativesForWallet(wallet: string): StoredCooperative[] {
  const data = getStore();
  const w = wallet.toLowerCase();
  const coopIds = new Set(
    data.members
      .filter((m) => m.walletIdentity.toLowerCase() === w && m.status === "active")
      .map((m) => m.coopId),
  );
  return data.cooperatives.filter((c) => coopIds.has(c.id));
}

export function getCooperative(id: string): StoredCooperative | null {
  return getStore().cooperatives.find((c) => c.id === id) ?? null;
}

export function findByInviteCode(code: string): StoredCooperative | null {
  const normalised = code.trim().toUpperCase();
  return getStore().cooperatives.find((c) => c.inviteCode === normalised) ?? null;
}

function normaliseRotationMode(mode?: string | null): RotationMode {
  if (
    mode === "JOIN_ORDER" ||
    mode === "RANDOM" ||
    mode === "ORGANIZER_ASSIGNED" ||
    mode === "GOVERNANCE_VOTE"
  ) {
    return mode;
  }
  return DEFAULT_ROTATION_MODE;
}

function canAcceptJoins(status: string | undefined): boolean {
  if (!status) return true;
  const s = status.toLowerCase();
  return s === "open" || s === "draft" || s === "pending";
}

function isJoiningClosed(status: string | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === "active" || s === "completed" || s === "inactive";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

function nextJoinPosition(currentMembers: number): number {
  return Math.max(0, currentMembers) + 1;
}

/** Members of a cooperative sorted by permanent join position. */
export function getMembers(coopId: string): StoredMember[] {
  const list = getStore().members.filter((m) => m.coopId === coopId);
  return [...list].sort((a, b) => {
    const pa = a.joinPosition ?? Number.MAX_SAFE_INTEGER;
    const pb = b.joinPosition ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
  });
}

export function getMemberByWallet(coopId: string, wallet: string): StoredMember | null {
  const w = wallet.toLowerCase();
  return (
    getStore().members.find(
      (m) => m.coopId === coopId && m.walletIdentity.toLowerCase() === w,
    ) ?? null
  );
}

export function getMemberByEmail(coopId: string, email: string): StoredMember | null {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  return (
    getStore().members.find(
      (m) =>
        m.coopId === coopId &&
        m.email &&
        m.email.trim().toLowerCase() === e,
    ) ?? null
  );
}

export type CreateCoopInput = {
  name: string;
  description?: string;
  type?: string;
  country?: string;
  currency?: string;
  contributionAmount?: number;
  contributionFrequency?: string;
  privacy?: string;
  votingModel?: string;
  approvalThreshold?: number;
  loanApprovalPolicy?: string;
  aiGovernanceEnabled?: boolean;
  maxMembers?: number;
  inviteCode?: string;
  rotationMode?: string;
  /** Initial status after create — defaults to open */
  status?: string;
  founderDisplayName?: string;
  founderEmail?: string;
};

function makeFounderMember(
  coopId: string,
  founderWallet: string,
  joinPosition: number,
  opts?: { displayName?: string; email?: string },
): StoredMember {
  const name = opts?.displayName?.trim() || "Founder";
  return {
    id: `mem-${randomUUID()}`,
    coopId,
    walletIdentity: founderWallet,
    name,
    displayName: name,
    email: opts?.email?.trim().toLowerCase() || undefined,
    role: "founder",
    status: "active",
    joinedAt: new Date().toISOString(),
    totalContributed: 0,
    joinPosition,
    contributionStatus: "waiting",
    hasReceivedPayout: false,
    creditScore: 70,
  };
}

export function createCooperative(
  input: CreateCoopInput,
  founderWallet: string,
): { coop: StoredCooperative; member: StoredMember; created: boolean } {
  const data = getStore();
  const inviteCode = (input.inviteCode ?? generateInviteCode()).toUpperCase();

  // Idempotent: reuse existing cooperative with same invite code
  const existing = data.cooperatives.find((c) => c.inviteCode === inviteCode);
  if (existing) {
    const member =
      data.members.find(
        (m) =>
          m.coopId === existing.id &&
          m.walletIdentity.toLowerCase() === founderWallet.toLowerCase(),
      ) ?? null;
    if (!member) {
      const currentCount = data.members.filter((m) => m.coopId === existing.id).length;
      const newMember = makeFounderMember(
        existing.id,
        founderWallet,
        nextJoinPosition(currentCount),
        {
          displayName: input.founderDisplayName,
          email: input.founderEmail,
        },
      );
      data.members.push(newMember);
      data.cooperatives = data.cooperatives.map((c) =>
        c.id === existing.id ? { ...c, memberCount: c.memberCount + 1 } : c,
      );
      commit(data);
      return {
        coop: data.cooperatives.find((c) => c.id === existing.id)!,
        member: newMember,
        created: false,
      };
    }
    return { coop: existing, member, created: false };
  }

  // Only JOIN_ORDER is implemented; store selected mode (future-ready) but
  // fall back to JOIN_ORDER if an unimplemented mode is forced somehow.
  let rotationMode = normaliseRotationMode(input.rotationMode);
  if (rotationMode !== "JOIN_ORDER") {
    // Still store the intended mode for architecture readiness when UI allows selection
    // of coming-soon options as display-only. For create API we accept only JOIN_ORDER
    // as functional default.
    rotationMode = DEFAULT_ROTATION_MODE;
  }

  // Launch cooperative as open so members can join
  const status = input.status?.toLowerCase() || "open";

  const id = `coop-${randomUUID()}`;
  const coop: StoredCooperative = {
    id,
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    type: input.type ?? "General",
    country: input.country ?? "",
    currency: input.currency ?? "USD",
    memberCount: 1,
    treasuryBalance: 0,
    contributionAmount: input.contributionAmount ?? 0,
    contributionFrequency: input.contributionFrequency ?? "monthly",
    walletIdentity: founderWallet,
    status,
    inviteCode,
    founderWalletIdentity: founderWallet,
    privacy: input.privacy,
    votingModel: input.votingModel,
    approvalThreshold: input.approvalThreshold,
    loanApprovalPolicy: input.loanApprovalPolicy,
    aiGovernanceEnabled: input.aiGovernanceEnabled,
    maxMembers: input.maxMembers,
    rotationMode,
    currentRecipientPosition: 1,
    currentCycle: 1,
    createdAt: new Date().toISOString(),
  };
  const member = makeFounderMember(id, founderWallet, 1, {
    displayName: input.founderDisplayName,
    email: input.founderEmail,
  });
  data.cooperatives.push(coop);
  data.members.push(member);
  commit(data);
  return { coop, member, created: true };
}

export type JoinCoopInput = {
  inviteCode: string;
  wallet: string;
  displayName?: string;
  email?: string;
};

/**
 * Member registration flow:
 * 1. Cooperative exists
 * 2. Status is OPEN (or draft/pending)
 * 3. Max members not reached
 * 4. Wallet not already joined
 * 5. Email not already joined
 * 6. Assign joinPosition = currentMembers + 1 (permanent)
 */
export function joinCooperative(
  inviteCode: string,
  wallet: string,
  displayName?: string,
  email?: string,
): {
  coop: StoredCooperative;
  member: StoredMember;
  joined: boolean;
  joinPosition: number;
} {
  const data = getStore();
  const code = inviteCode.trim().toUpperCase();
  const coopIdx = data.cooperatives.findIndex((c) => c.inviteCode === code);
  if (coopIdx === -1) {
    throw Object.assign(new Error("Invalid invite code — cooperative not found"), {
      status: 404,
    });
  }
  let coop = data.cooperatives[coopIdx];
  const w = wallet.toLowerCase();

  // Already a member (idempotent) — do not reassign position
  const existingMember = data.members.find(
    (m) => m.coopId === coop.id && m.walletIdentity.toLowerCase() === w,
  );
  if (existingMember) {
    return {
      coop,
      member: existingMember,
      joined: false,
      joinPosition: existingMember.joinPosition ?? 0,
    };
  }

  if (isJoiningClosed(coop.status) || !canAcceptJoins(coop.status)) {
    throw Object.assign(
      new Error("Joining is closed. This cooperative is no longer accepting new members."),
      { status: 400 },
    );
  }

  if (coop.maxMembers && coop.memberCount >= coop.maxMembers) {
    throw Object.assign(new Error("Maximum members has been reached"), {
      status: 400,
    });
  }

  const emailNorm = email?.trim().toLowerCase() ?? "";
  if (emailNorm) {
    if (!isValidEmail(emailNorm)) {
      throw Object.assign(new Error("Please enter a valid email address"), {
        status: 400,
      });
    }
    const emailTaken = data.members.find(
      (m) =>
        m.coopId === coop.id &&
        m.email &&
        m.email.trim().toLowerCase() === emailNorm,
    );
    if (emailTaken) {
      throw Object.assign(
        new Error("This email has already joined this cooperative"),
        { status: 400 },
      );
    }
  }

  const currentMembers = data.members.filter((m) => m.coopId === coop.id).length;
  const joinPosition = nextJoinPosition(currentMembers);
  const name = displayName?.trim() || shortWallet(wallet);

  const member: StoredMember = {
    id: `mem-${randomUUID()}`,
    coopId: coop.id,
    walletIdentity: wallet,
    name,
    displayName: name,
    email: emailNorm || undefined,
    role: "member",
    status: "active",
    joinedAt: new Date().toISOString(),
    totalContributed: 0,
    joinPosition,
    contributionStatus: "waiting",
    hasReceivedPayout: false,
    creditScore: 70,
  };
  data.members.push(member);

  const newCount = coop.memberCount + 1;
  let nextStatus = coop.status;
  // Auto-activate when max members reached
  if (
    coop.maxMembers &&
    newCount >= coop.maxMembers &&
    canAcceptJoins(coop.status)
  ) {
    nextStatus = "active";
  }

  data.cooperatives[coopIdx] = {
    ...coop,
    memberCount: newCount,
    status: nextStatus,
    currentRecipientPosition: coop.currentRecipientPosition ?? 1,
    currentCycle: coop.currentCycle ?? 1,
  };
  commit(data);
  return {
    coop: data.cooperatives[coopIdx],
    member,
    joined: true,
    joinPosition,
  };
}

/**
 * Owner starts the cooperative: close joining, lock payout order.
 */
export function activateCooperative(
  coopId: string,
  requesterWallet: string,
): StoredCooperative {
  const data = getStore();
  const idx = data.cooperatives.findIndex((c) => c.id === coopId);
  if (idx === -1) {
    throw Object.assign(new Error("Cooperative not found"), { status: 404 });
  }
  const coop = data.cooperatives[idx];
  const w = requesterWallet.toLowerCase();
  const isFounder = coop.founderWalletIdentity.toLowerCase() === w;
  const isAdmin = data.members.some(
    (m) =>
      m.coopId === coop.id &&
      m.walletIdentity.toLowerCase() === w &&
      (m.role === "founder" || m.role === "admin") &&
      m.status === "active",
  );
  if (!isFounder && !isAdmin) {
    throw Object.assign(
      new Error("Only the cooperative owner or an admin can start the cooperative"),
      { status: 403 },
    );
  }
  if (coop.status === "active" || coop.status === "completed") {
    return coop;
  }
  data.cooperatives[idx] = {
    ...coop,
    status: "active",
    currentRecipientPosition: coop.currentRecipientPosition ?? 1,
    currentCycle: coop.currentCycle ?? 1,
  };
  commit(data);
  return data.cooperatives[idx];
}

/** Cooperative summary for dashboards */
export function getCooperativeSummary(coopId: string) {
  const coop = getCooperative(coopId);
  if (!coop) return null;
  const members = getMembers(coopId);
  const currentPos = coop.currentRecipientPosition ?? 1;
  const maxPos = members.length;
  const nextPos = maxPos > 0 && currentPos < maxPos ? currentPos + 1 : null;
  const status = coop.status ?? "open";
  const joiningClosed =
    isJoiningClosed(status) ||
    (typeof coop.maxMembers === "number" &&
      coop.maxMembers > 0 &&
      coop.memberCount >= coop.maxMembers);

  return {
    id: coop.id,
    name: coop.name,
    memberCount: coop.memberCount,
    maxMembers: coop.maxMembers ?? null,
    currentRecipientPosition: currentPos,
    nextRecipientPosition: nextPos,
    contributionAmount: coop.contributionAmount,
    contributionFrequency: coop.contributionFrequency,
    status,
    rotationMode: normaliseRotationMode(coop.rotationMode),
    currentCycle: coop.currentCycle ?? 1,
    joiningClosed,
  };
}

// ── Transactions ───────────────────────────────────────────────────────────────

export function listTransactions(opts: {
  coopId?: string;
  wallet?: string;
  limit?: number;
}): StoredTransaction[] {
  let list = getStore().transactions;
  if (opts.coopId) list = list.filter((t) => t.coopId === opts.coopId);
  if (opts.wallet) {
    const w = opts.wallet.toLowerCase();
    list = list.filter((t) => t.walletIdentity.toLowerCase() === w);
  }
  list = [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  if (opts.limit && opts.limit > 0) list = list.slice(0, opts.limit);
  return list;
}

export function recordTransaction(input: {
  coopId: string;
  walletIdentity: string;
  type: TxType;
  amount: number;
  note?: string;
}): StoredTransaction {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw Object.assign(new Error("Amount must be a positive number"), {
      status: 400,
    });
  }
  const data = getStore();
  const coopIdx = data.cooperatives.findIndex((c) => c.id === input.coopId);
  if (coopIdx === -1) {
    throw Object.assign(new Error("Cooperative not found"), { status: 404 });
  }
  const coop = data.cooperatives[coopIdx];
  const w = input.walletIdentity.toLowerCase();
  const memberIdx = data.members.findIndex(
    (m) => m.coopId === coop.id && m.walletIdentity.toLowerCase() === w,
  );
  if (memberIdx === -1) {
    throw Object.assign(new Error("You are not a member of this cooperative"), {
      status: 403,
    });
  }

  let nextBalance = coop.treasuryBalance;
  if (input.type === "deposit" || input.type === "contribution") {
    nextBalance += input.amount;
  } else if (input.type === "withdrawal") {
    if (input.amount > coop.treasuryBalance) {
      throw Object.assign(new Error("Insufficient treasury balance"), {
        status: 400,
      });
    }
    nextBalance -= input.amount;
  }

  const tx: StoredTransaction = {
    id: `tx-${randomUUID()}`,
    coopId: coop.id,
    walletIdentity: input.walletIdentity,
    type: input.type,
    amount: input.amount,
    currency: coop.currency || "USD",
    note: input.note,
    createdAt: new Date().toISOString(),
  };

  data.transactions.unshift(tx);
  data.cooperatives[coopIdx] = { ...coop, treasuryBalance: nextBalance };

  if (input.type === "deposit" || input.type === "contribution") {
    const m = data.members[memberIdx];
    data.members[memberIdx] = {
      ...m,
      totalContributed:
        Math.round((m.totalContributed + input.amount) * 100) / 100,
      contributionStatus: "paid",
    };
  }

  commit(data);
  return tx;
}

export function getTreasurySnapshot(coopId: string) {
  const coop = getCooperative(coopId);
  if (!coop) return null;
  const txs = listTransactions({ coopId, limit: 500 });
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  let monthlyInflow = 0;
  let monthlyOutflow = 0;
  for (const t of txs) {
    if (new Date(t.createdAt).getTime() < monthStart) continue;
    if (t.type === "deposit" || t.type === "contribution") monthlyInflow += t.amount;
    if (t.type === "withdrawal") monthlyOutflow += t.amount;
  }
  const available = Math.max(0, coop.treasuryBalance * 0.6);
  const loanPool = Math.max(0, coop.treasuryBalance * 0.3);
  const reserved = Math.max(0, coop.treasuryBalance - available - loanPool);
  return {
    availableBalance: Math.round(available * 100) / 100,
    reservedFunds: Math.round(reserved * 100) / 100,
    loanPool: Math.round(loanPool * 100) / 100,
    emergencyReserve: Math.round(reserved * 100) / 100,
    pendingContributions: 0,
    monthlyInflow,
    monthlyOutflow,
    netFlow: monthlyInflow - monthlyOutflow,
    totalBalance: coop.treasuryBalance,
    currency: coop.currency,
  };
}

// ── On-chain Arc transfers ─────────────────────────────────────────────────────

export type IngestOnchainInput = {
  txHash: string;
  logIndex?: number | null;
  wallet: string;
  direction: "in" | "out";
  amount: number;
  token?: "usdc-erc20" | "usdc-native";
  counterparty?: string;
  blockNumber?: number;
  explorerUrl?: string;
  timestamp?: string;
};

export function findOnchainTransfer(key: string): StoredOnchainTransfer | null {
  return getStore().onchainTransfers.find((t) => t.key === key) ?? null;
}

/**
 * Persist a unique on-chain transfer. Returns { transfer, created }.
 * Duplicates (same txHash + logIndex) are ignored.
 */
export function ingestOnchainTransfer(
  input: IngestOnchainInput,
): { transfer: StoredOnchainTransfer; created: boolean } {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw Object.assign(new Error("amount must be a positive number"), {
      status: 400,
    });
  }
  if (!input.txHash?.trim()) {
    throw Object.assign(new Error("txHash is required"), { status: 400 });
  }
  if (!input.wallet?.trim()) {
    throw Object.assign(new Error("wallet is required"), { status: 400 });
  }

  const logIndex =
    typeof input.logIndex === "number" && Number.isFinite(input.logIndex)
      ? input.logIndex
      : null;
  const key =
    logIndex === null
      ? `${input.txHash.toLowerCase()}:native:${input.wallet.toLowerCase()}:${input.direction}`
      : `${input.txHash.toLowerCase()}:${logIndex}`;

  const data = getStore();
  const existing = data.onchainTransfers.find((t) => t.key === key);
  if (existing) {
    return { transfer: existing, created: false };
  }

  const transfer: StoredOnchainTransfer = {
    id: `octx-${randomUUID()}`,
    key,
    txHash: input.txHash,
    logIndex,
    wallet: input.wallet,
    direction: input.direction,
    amount: input.amount,
    token: input.token ?? "usdc-erc20",
    counterparty: input.counterparty ?? "",
    blockNumber: input.blockNumber ?? 0,
    explorerUrl: input.explorerUrl,
    createdAt: input.timestamp ?? new Date().toISOString(),
  };

  data.onchainTransfers.unshift(transfer);
  if (data.onchainTransfers.length > 5000) {
    data.onchainTransfers = data.onchainTransfers.slice(0, 5000);
  }
  commit(data);
  return { transfer, created: true };
}

export function listOnchainTransfers(
  wallet: string,
  limit = 50,
): StoredOnchainTransfer[] {
  const w = wallet.toLowerCase();
  return getStore()
    .onchainTransfers.filter((t) => t.wallet.toLowerCase() === w)
    .slice(0, limit);
}

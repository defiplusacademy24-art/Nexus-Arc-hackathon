/**
 * Postgres-backed domain store (production path when DATABASE_URL is set).
 */

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  ensureSchema,
  getDb,
  cooperativesTable,
  membersTable,
  transactionsTable,
  notificationsTable,
  onchainTransfersTable,
  agentsTable,
  type CooperativeRow,
  type MemberRow,
  type TransactionRow,
  type NotificationRow,
  type OnchainTransferRow,
} from "@workspace/db";
import type {
  CreateCoopInput,
  CreateNotificationInput,
  IngestOnchainInput,
  PlatformStats,
  StoredCooperative,
  StoredMember,
  StoredNotification,
  StoredOnchainTransfer,
  StoredTransaction,
  TxType,
  RotationMode,
} from "./store-types";
import {
  DEFAULT_ROTATION_MODE,
} from "./store-types";

let ready: Promise<void> | null = null;

async function readyDb() {
  if (!ready) {
    ready = ensureSchema();
  }
  await ready;
  return getDb();
}

function ts(d: Date | string | null | undefined): string {
  if (!d) return new Date().toISOString();
  if (d instanceof Date) return d.toISOString();
  return new Date(d).toISOString();
}

function mapCoop(r: CooperativeRow): StoredCooperative {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    type: r.type,
    country: r.country ?? "",
    currency: r.currency ?? "USD",
    memberCount: r.memberCount,
    treasuryBalance: r.treasuryBalance,
    contributionAmount: r.contributionAmount,
    contributionFrequency: r.contributionFrequency,
    walletIdentity: r.walletIdentity,
    status: r.status,
    inviteCode: r.inviteCode,
    founderWalletIdentity: r.founderWalletIdentity,
    privacy: r.privacy ?? undefined,
    votingModel: r.votingModel ?? undefined,
    approvalThreshold: r.approvalThreshold ?? undefined,
    loanApprovalPolicy: r.loanApprovalPolicy ?? undefined,
    aiGovernanceEnabled: r.aiGovernanceEnabled ?? undefined,
    maxMembers: r.maxMembers ?? undefined,
    rotationMode: (r.rotationMode as RotationMode) ?? undefined,
    currentRecipientPosition: r.currentRecipientPosition ?? undefined,
    currentCycle: r.currentCycle ?? undefined,
    createdAt: ts(r.createdAt),
  };
}

function mapMember(r: MemberRow): StoredMember {
  return {
    id: r.id,
    coopId: r.coopId,
    walletIdentity: r.walletIdentity,
    name: r.name,
    displayName: r.displayName ?? undefined,
    email: r.email ?? undefined,
    role: r.role,
    status: r.status,
    joinedAt: ts(r.joinedAt),
    totalContributed: r.totalContributed,
    joinPosition: r.joinPosition ?? undefined,
    contributionStatus: (r.contributionStatus as StoredMember["contributionStatus"]) ?? undefined,
    hasReceivedPayout: r.hasReceivedPayout ?? undefined,
    creditScore: r.creditScore ?? undefined,
  };
}

function mapTx(r: TransactionRow): StoredTransaction {
  return {
    id: r.id,
    coopId: r.coopId,
    walletIdentity: r.walletIdentity,
    type: r.type as TxType,
    amount: r.amount,
    currency: r.currency,
    note: r.note ?? undefined,
    createdAt: ts(r.createdAt),
  };
}

function mapNotif(r: NotificationRow): StoredNotification {
  return {
    id: r.id,
    recipientWallet: r.recipientWallet,
    coopId: r.coopId,
    type: r.type as StoredNotification["type"],
    title: r.title,
    description: r.description,
    timestamp: ts(r.timestamp),
    read: r.read,
    actionLabel: r.actionLabel ?? undefined,
    actionHref: r.actionHref ?? undefined,
    metadata: r.metadata ?? undefined,
  };
}

function mapOnchain(r: OnchainTransferRow): StoredOnchainTransfer {
  return {
    id: r.id,
    key: r.key,
    txHash: r.txHash,
    logIndex: r.logIndex,
    wallet: r.wallet,
    direction: r.direction as "in" | "out",
    amount: r.amount,
    token: r.token as "usdc-erc20" | "usdc-native",
    counterparty: r.counterparty,
    blockNumber: r.blockNumber,
    explorerUrl: r.explorerUrl ?? undefined,
    createdAt: ts(r.createdAt),
  };
}

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

// ── Notifications ──────────────────────────────────────────────────────────────

export async function listNotifications(opts: {
  wallet: string;
  unreadOnly?: boolean;
  limit?: number;
}): Promise<StoredNotification[]> {
  const db = await readyDb();
  const wallet = opts.wallet.toLowerCase();
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(
      opts.unreadOnly
        ? and(
            sql`lower(${notificationsTable.recipientWallet}) = ${wallet}`,
            eq(notificationsTable.read, false),
          )
        : sql`lower(${notificationsTable.recipientWallet}) = ${wallet}`,
    )
    .orderBy(desc(notificationsTable.timestamp))
    .limit(opts.limit && opts.limit > 0 ? opts.limit : 100);
  return rows.map(mapNotif);
}

export async function unreadCount(wallet: string): Promise<number> {
  const db = await readyDb();
  const w = wallet.toLowerCase();
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(notificationsTable)
    .where(
      and(
        sql`lower(${notificationsTable.recipientWallet}) = ${w}`,
        eq(notificationsTable.read, false),
      ),
    );
  return rows[0]?.c ?? 0;
}

export async function markNotificationRead(
  id: string,
  wallet: string,
): Promise<StoredNotification | null> {
  const db = await readyDb();
  const w = wallet.toLowerCase();
  const existing = await db
    .select()
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.id, id),
        sql`lower(${notificationsTable.recipientWallet}) = ${w}`,
      ),
    )
    .limit(1);
  if (!existing[0]) return null;
  const [updated] = await db
    .update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.id, id))
    .returning();
  return updated ? mapNotif(updated) : null;
}

export async function markAllNotificationsRead(wallet: string): Promise<number> {
  const db = await readyDb();
  const w = wallet.toLowerCase();
  const result = await db
    .update(notificationsTable)
    .set({ read: true })
    .where(
      and(
        sql`lower(${notificationsTable.recipientWallet}) = ${w}`,
        eq(notificationsTable.read, false),
      ),
    )
    .returning({ id: notificationsTable.id });
  return result.length;
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<StoredNotification> {
  const db = await readyDb();
  const notif = {
    id: `notif-${randomUUID()}`,
    recipientWallet: input.recipientWallet,
    coopId: input.coopId ?? null,
    type: input.type,
    title: input.title,
    description: input.description,
    timestamp: new Date(),
    read: false,
    actionLabel: input.actionLabel ?? null,
    actionHref: input.actionHref ?? null,
    metadata: input.metadata ?? null,
  };
  const [row] = await db.insert(notificationsTable).values(notif).returning();
  return mapNotif(row);
}

export async function createNotifications(
  inputs: CreateNotificationInput[],
): Promise<StoredNotification[]> {
  const out: StoredNotification[] = [];
  for (const i of inputs) {
    out.push(await createNotification(i));
  }
  return out;
}

// ── Cooperatives ───────────────────────────────────────────────────────────────

export async function listCooperativesForWallet(
  wallet: string,
): Promise<StoredCooperative[]> {
  const db = await readyDb();
  const w = wallet.toLowerCase();
  const memberRows = await db
    .select({ coopId: membersTable.coopId })
    .from(membersTable)
    .where(
      and(
        sql`lower(${membersTable.walletIdentity}) = ${w}`,
        eq(membersTable.status, "active"),
      ),
    );
  if (memberRows.length === 0) return [];
  const ids = [...new Set(memberRows.map((m: { coopId: string }) => m.coopId))];
  const rows = await db
    .select()
    .from(cooperativesTable)
    .where(inArray(cooperativesTable.id, ids));
  return rows.map(mapCoop);
}

export async function getCooperative(id: string): Promise<StoredCooperative | null> {
  const db = await readyDb();
  const rows = await db
    .select()
    .from(cooperativesTable)
    .where(eq(cooperativesTable.id, id))
    .limit(1);
  return rows[0] ? mapCoop(rows[0]) : null;
}

export async function findByInviteCode(code: string): Promise<StoredCooperative | null> {
  const db = await readyDb();
  const normalised = code.trim().toUpperCase();
  const rows = await db
    .select()
    .from(cooperativesTable)
    .where(eq(cooperativesTable.inviteCode, normalised))
    .limit(1);
  return rows[0] ? mapCoop(rows[0]) : null;
}

export async function getMembers(coopId: string): Promise<StoredMember[]> {
  const db = await readyDb();
  const list = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.coopId, coopId));
  return list
    .map(mapMember)
    .sort((a: StoredMember, b: StoredMember) => {
      const pa = a.joinPosition ?? Number.MAX_SAFE_INTEGER;
      const pb = b.joinPosition ?? Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
    });
}

export async function getMemberByWallet(
  coopId: string,
  wallet: string,
): Promise<StoredMember | null> {
  const db = await readyDb();
  const w = wallet.toLowerCase();
  const rows = await db
    .select()
    .from(membersTable)
    .where(
      and(
        eq(membersTable.coopId, coopId),
        sql`lower(${membersTable.walletIdentity}) = ${w}`,
      ),
    )
    .limit(1);
  return rows[0] ? mapMember(rows[0]) : null;
}

export async function createCooperative(
  input: CreateCoopInput,
  founderWallet: string,
): Promise<{ coop: StoredCooperative; member: StoredMember; created: boolean }> {
  const db = await readyDb();
  const inviteCode = (input.inviteCode ?? generateInviteCode()).toUpperCase();

  const existingRows = await db
    .select()
    .from(cooperativesTable)
    .where(eq(cooperativesTable.inviteCode, inviteCode))
    .limit(1);

  if (existingRows[0]) {
    const existing = mapCoop(existingRows[0]);
    let member = await getMemberByWallet(existing.id, founderWallet);
    if (!member) {
      const current = await getMembers(existing.id);
      const newMember: StoredMember = {
        id: `mem-${randomUUID()}`,
        coopId: existing.id,
        walletIdentity: founderWallet,
        name: input.founderDisplayName?.trim() || "Founder",
        displayName: input.founderDisplayName?.trim() || "Founder",
        email: input.founderEmail?.trim().toLowerCase() || undefined,
        role: "founder",
        status: "active",
        joinedAt: new Date().toISOString(),
        totalContributed: 0,
        joinPosition: nextJoinPosition(current.length),
        contributionStatus: "waiting",
        hasReceivedPayout: false,
        creditScore: 70,
      };
      await db.insert(membersTable).values({
        id: newMember.id,
        coopId: newMember.coopId,
        walletIdentity: newMember.walletIdentity,
        name: newMember.name,
        displayName: newMember.displayName ?? null,
        email: newMember.email ?? null,
        role: newMember.role,
        status: newMember.status,
        joinedAt: new Date(newMember.joinedAt),
        totalContributed: 0,
        joinPosition: newMember.joinPosition ?? null,
        contributionStatus: newMember.contributionStatus ?? null,
        hasReceivedPayout: false,
        creditScore: 70,
      });
      await db
        .update(cooperativesTable)
        .set({ memberCount: existing.memberCount + 1 })
        .where(eq(cooperativesTable.id, existing.id));
      const coop = (await getCooperative(existing.id))!;
      return { coop, member: newMember, created: false };
    }
    return { coop: existing, member, created: false };
  }

  const rotationMode = DEFAULT_ROTATION_MODE;
  const status = input.status?.toLowerCase() || "open";
  const id = `coop-${randomUUID()}`;
  const now = new Date();

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
    createdAt: now.toISOString(),
  };

  const member: StoredMember = {
    id: `mem-${randomUUID()}`,
    coopId: id,
    walletIdentity: founderWallet,
    name: input.founderDisplayName?.trim() || "Founder",
    displayName: input.founderDisplayName?.trim() || "Founder",
    email: input.founderEmail?.trim().toLowerCase() || undefined,
    role: "founder",
    status: "active",
    joinedAt: now.toISOString(),
    totalContributed: 0,
    joinPosition: 1,
    contributionStatus: "waiting",
    hasReceivedPayout: false,
    creditScore: 70,
  };

  await db.insert(cooperativesTable).values({
    id: coop.id,
    name: coop.name,
    description: coop.description,
    type: coop.type,
    country: coop.country,
    currency: coop.currency,
    memberCount: 1,
    treasuryBalance: 0,
    contributionAmount: coop.contributionAmount,
    contributionFrequency: coop.contributionFrequency,
    walletIdentity: founderWallet,
    status: coop.status,
    inviteCode: coop.inviteCode,
    founderWalletIdentity: founderWallet,
    privacy: coop.privacy ?? null,
    votingModel: coop.votingModel ?? null,
    approvalThreshold: coop.approvalThreshold ?? null,
    loanApprovalPolicy: coop.loanApprovalPolicy ?? null,
    aiGovernanceEnabled: coop.aiGovernanceEnabled ?? null,
    maxMembers: coop.maxMembers ?? null,
    rotationMode: coop.rotationMode ?? null,
    currentRecipientPosition: 1,
    currentCycle: 1,
    createdAt: now,
  });

  await db.insert(membersTable).values({
    id: member.id,
    coopId: id,
    walletIdentity: founderWallet,
    name: member.name,
    displayName: member.displayName ?? null,
    email: member.email ?? null,
    role: "founder",
    status: "active",
    joinedAt: now,
    totalContributed: 0,
    joinPosition: 1,
    contributionStatus: "waiting",
    hasReceivedPayout: false,
    creditScore: 70,
  });

  return { coop, member, created: true };
}

export async function joinCooperative(
  inviteCode: string,
  wallet: string,
  displayName?: string,
  email?: string,
): Promise<{
  coop: StoredCooperative;
  member: StoredMember;
  joined: boolean;
  joinPosition: number;
}> {
  const db = await readyDb();
  const code = inviteCode.trim().toUpperCase();
  const coop = await findByInviteCode(code);
  if (!coop) {
    throw Object.assign(new Error("Invalid invite code — cooperative not found"), {
      status: 404,
    });
  }
  const w = wallet.toLowerCase();

  const existingMember = await getMemberByWallet(coop.id, wallet);
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
    const emailTaken = await db
      .select()
      .from(membersTable)
      .where(
        and(
          eq(membersTable.coopId, coop.id),
          sql`lower(${membersTable.email}) = ${emailNorm}`,
        ),
      )
      .limit(1);
    if (emailTaken[0]) {
      throw Object.assign(
        new Error("This email has already joined this cooperative"),
        { status: 400 },
      );
    }
  }

  const currentMembers = await getMembers(coop.id);
  const joinPosition = nextJoinPosition(currentMembers.length);
  const name = displayName?.trim() || shortWallet(wallet);
  const now = new Date();

  const member: StoredMember = {
    id: `mem-${randomUUID()}`,
    coopId: coop.id,
    walletIdentity: wallet,
    name,
    displayName: name,
    email: emailNorm || undefined,
    role: "member",
    status: "active",
    joinedAt: now.toISOString(),
    totalContributed: 0,
    joinPosition,
    contributionStatus: "waiting",
    hasReceivedPayout: false,
    creditScore: 70,
  };

  await db.insert(membersTable).values({
    id: member.id,
    coopId: member.coopId,
    walletIdentity: member.walletIdentity,
    name: member.name,
    displayName: member.displayName ?? null,
    email: member.email ?? null,
    role: member.role,
    status: member.status,
    joinedAt: now,
    totalContributed: 0,
    joinPosition,
    contributionStatus: "waiting",
    hasReceivedPayout: false,
    creditScore: 70,
  });

  const newCount = coop.memberCount + 1;
  let nextStatus = coop.status;
  if (coop.maxMembers && newCount >= coop.maxMembers && canAcceptJoins(coop.status)) {
    nextStatus = "active";
  }

  await db
    .update(cooperativesTable)
    .set({
      memberCount: newCount,
      status: nextStatus,
      currentRecipientPosition: coop.currentRecipientPosition ?? 1,
      currentCycle: coop.currentCycle ?? 1,
    })
    .where(eq(cooperativesTable.id, coop.id));

  const updated = (await getCooperative(coop.id))!;
  return { coop: updated, member, joined: true, joinPosition };
}

export async function activateCooperative(
  coopId: string,
  requesterWallet: string,
): Promise<StoredCooperative> {
  const db = await readyDb();
  const coop = await getCooperative(coopId);
  if (!coop) {
    throw Object.assign(new Error("Cooperative not found"), { status: 404 });
  }
  const w = requesterWallet.toLowerCase();
  const isFounder = coop.founderWalletIdentity.toLowerCase() === w;
  const members = await getMembers(coopId);
  const isAdmin = members.some(
    (m) =>
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
  await db
    .update(cooperativesTable)
    .set({
      status: "active",
      currentRecipientPosition: coop.currentRecipientPosition ?? 1,
      currentCycle: coop.currentCycle ?? 1,
    })
    .where(eq(cooperativesTable.id, coopId));
  return (await getCooperative(coopId))!;
}

export async function getCooperativeSummary(coopId: string) {
  const coop = await getCooperative(coopId);
  if (!coop) return null;
  const members = await getMembers(coopId);
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

export async function listTransactions(opts: {
  coopId?: string;
  wallet?: string;
  limit?: number;
}): Promise<StoredTransaction[]> {
  const db = await readyDb();
  let rows: TransactionRow[];
  if (opts.coopId && opts.wallet) {
    const w = opts.wallet.toLowerCase();
    rows = await db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.coopId, opts.coopId),
          sql`lower(${transactionsTable.walletIdentity}) = ${w}`,
        ),
      )
      .orderBy(desc(transactionsTable.createdAt))
      .limit(opts.limit && opts.limit > 0 ? opts.limit : 500);
  } else if (opts.coopId) {
    rows = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.coopId, opts.coopId))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(opts.limit && opts.limit > 0 ? opts.limit : 500);
  } else if (opts.wallet) {
    const w = opts.wallet.toLowerCase();
    rows = await db
      .select()
      .from(transactionsTable)
      .where(sql`lower(${transactionsTable.walletIdentity}) = ${w}`)
      .orderBy(desc(transactionsTable.createdAt))
      .limit(opts.limit && opts.limit > 0 ? opts.limit : 500);
  } else {
    rows = await db
      .select()
      .from(transactionsTable)
      .orderBy(desc(transactionsTable.createdAt))
      .limit(opts.limit && opts.limit > 0 ? opts.limit : 500);
  }
  return rows.map(mapTx);
}

export async function recordTransaction(input: {
  coopId: string;
  walletIdentity: string;
  type: TxType;
  amount: number;
  note?: string;
}): Promise<StoredTransaction> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw Object.assign(new Error("Amount must be a positive number"), {
      status: 400,
    });
  }
  const db = await readyDb();
  const coop = await getCooperative(input.coopId);
  if (!coop) {
    throw Object.assign(new Error("Cooperative not found"), { status: 404 });
  }
  const member = await getMemberByWallet(coop.id, input.walletIdentity);
  if (!member) {
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

  const now = new Date();
  const tx: StoredTransaction = {
    id: `tx-${randomUUID()}`,
    coopId: coop.id,
    walletIdentity: input.walletIdentity,
    type: input.type,
    amount: input.amount,
    currency: coop.currency || "USD",
    note: input.note,
    createdAt: now.toISOString(),
  };

  await db.insert(transactionsTable).values({
    id: tx.id,
    coopId: tx.coopId,
    walletIdentity: tx.walletIdentity,
    type: tx.type,
    amount: tx.amount,
    currency: tx.currency,
    note: tx.note ?? null,
    createdAt: now,
  });

  await db
    .update(cooperativesTable)
    .set({ treasuryBalance: nextBalance })
    .where(eq(cooperativesTable.id, coop.id));

  if (input.type === "deposit" || input.type === "contribution") {
    await db
      .update(membersTable)
      .set({
        totalContributed:
          Math.round((member.totalContributed + input.amount) * 100) / 100,
        contributionStatus: "paid",
      })
      .where(eq(membersTable.id, member.id));
  }

  return tx;
}

export async function getTreasurySnapshot(coopId: string) {
  const coop = await getCooperative(coopId);
  if (!coop) return null;
  const txs = await listTransactions({ coopId, limit: 500 });
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

// ── On-chain ───────────────────────────────────────────────────────────────────

export async function findOnchainTransfer(
  key: string,
): Promise<StoredOnchainTransfer | null> {
  const db = await readyDb();
  const rows = await db
    .select()
    .from(onchainTransfersTable)
    .where(eq(onchainTransfersTable.key, key))
    .limit(1);
  return rows[0] ? mapOnchain(rows[0]) : null;
}

export async function ingestOnchainTransfer(
  input: IngestOnchainInput,
): Promise<{ transfer: StoredOnchainTransfer; created: boolean }> {
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

  const existing = await findOnchainTransfer(key);
  if (existing) {
    return { transfer: existing, created: false };
  }

  const db = await readyDb();
  const now = input.timestamp ? new Date(input.timestamp) : new Date();
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
    createdAt: now.toISOString(),
  };

  await db.insert(onchainTransfersTable).values({
    id: transfer.id,
    key: transfer.key,
    txHash: transfer.txHash,
    logIndex: transfer.logIndex,
    wallet: transfer.wallet,
    direction: transfer.direction,
    amount: transfer.amount,
    token: transfer.token,
    counterparty: transfer.counterparty,
    blockNumber: transfer.blockNumber,
    explorerUrl: transfer.explorerUrl ?? null,
    createdAt: now,
  });

  return { transfer, created: true };
}

export async function listOnchainTransfers(
  wallet: string,
  limit = 50,
): Promise<StoredOnchainTransfer[]> {
  const db = await readyDb();
  const w = wallet.toLowerCase();
  const rows = await db
    .select()
    .from(onchainTransfersTable)
    .where(sql`lower(${onchainTransfersTable.wallet}) = ${w}`)
    .orderBy(desc(onchainTransfersTable.createdAt))
    .limit(limit);
  return rows.map(mapOnchain);
}

/** Full hydrate payload for a wallet (coops + members). */
export async function hydrateForWallet(wallet: string): Promise<{
  cooperatives: StoredCooperative[];
  membersByCoop: Record<string, StoredMember[]>;
}> {
  const cooperatives = await listCooperativesForWallet(wallet);
  const membersByCoop: Record<string, StoredMember[]> = {};
  for (const c of cooperatives) {
    membersByCoop[c.id] = await getMembers(c.id);
  }
  return { cooperatives, membersByCoop };
}

/** Public platform metrics for the landing page (no auth). */
export async function getPlatformStats(): Promise<PlatformStats> {
  const db = await readyDb();

  const [coopCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(cooperativesTable);
  const [activeCoopCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(cooperativesTable)
    .where(
      sql`lower(${cooperativesTable.status}) IN ('open', 'active', 'draft', 'pending')`,
    );
  const [memberCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(membersTable)
    .where(eq(membersTable.status, "active"));
  const [txCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(transactionsTable);
  const [agentsRunning] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(agentsTable)
    .where(eq(agentsTable.status, "running"));
  const [agentsTotal] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(agentsTable);

  return {
    cooperatives: coopCount?.c ?? 0,
    activeCooperatives: activeCoopCount?.c ?? 0,
    members: memberCount?.c ?? 0,
    agentsRunning: agentsRunning?.c ?? 0,
    agentsTotal: agentsTotal?.c ?? 0,
    transactions: txCount?.c ?? 0,
    storage: "postgres",
    updatedAt: new Date().toISOString(),
  };
}

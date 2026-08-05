/**
 * Domain store facade.
 * - Postgres when DATABASE_URL is set (production / durable)
 * - JSON file under data/ or /tmp when DATABASE_URL is missing (local demo only)
 */

import { isDatabaseConfigured } from "@workspace/db";
import * as file from "./store-file";
import * as pg from "./store-pg";
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
} from "./store-types";

export type {
  NotifType,
  StoredNotification,
  RotationMode,
  CoopLifecycleStatus,
  ContributionStatus,
  StoredCooperative,
  StoredMember,
  TxType,
  StoredTransaction,
  StoredOnchainTransfer,
  CreateNotificationInput,
  CreateCoopInput,
  JoinCoopInput,
  IngestOnchainInput,
  PlatformStats,
  StoredAgent,
  AgentStatus,
} from "./store-types";

export { DEFAULT_ROTATION_MODE } from "./store-types";

function usePg(): boolean {
  return isDatabaseConfigured();
}

export function storageBackend(): "postgres" | "file" {
  return usePg() ? "postgres" : "file";
}

// ── Notifications ──────────────────────────────────────────────────────────────

export async function listNotifications(opts: {
  wallet: string;
  unreadOnly?: boolean;
  limit?: number;
}): Promise<StoredNotification[]> {
  if (usePg()) return pg.listNotifications(opts);
  return file.listNotifications(opts);
}

export async function unreadCount(wallet: string): Promise<number> {
  if (usePg()) return pg.unreadCount(wallet);
  return file.unreadCount(wallet);
}

export async function markNotificationRead(
  id: string,
  wallet: string,
): Promise<StoredNotification | null> {
  if (usePg()) return pg.markNotificationRead(id, wallet);
  return file.markNotificationRead(id, wallet);
}

export async function markAllNotificationsRead(wallet: string): Promise<number> {
  if (usePg()) return pg.markAllNotificationsRead(wallet);
  return file.markAllNotificationsRead(wallet);
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<StoredNotification> {
  if (usePg()) return pg.createNotification(input);
  return file.createNotification(input);
}

export async function createNotifications(
  inputs: CreateNotificationInput[],
): Promise<StoredNotification[]> {
  if (usePg()) return pg.createNotifications(inputs);
  return file.createNotifications(inputs);
}

// ── Cooperatives ───────────────────────────────────────────────────────────────

export async function listCooperativesForWallet(
  wallet: string,
): Promise<StoredCooperative[]> {
  if (usePg()) return pg.listCooperativesForWallet(wallet);
  return file.listCooperativesForWallet(wallet);
}

export async function getCooperative(id: string): Promise<StoredCooperative | null> {
  if (usePg()) return pg.getCooperative(id);
  return file.getCooperative(id);
}

export async function findByInviteCode(code: string): Promise<StoredCooperative | null> {
  if (usePg()) return pg.findByInviteCode(code);
  return file.findByInviteCode(code);
}

export async function getMembers(coopId: string): Promise<StoredMember[]> {
  if (usePg()) return pg.getMembers(coopId);
  return file.getMembers(coopId);
}

export async function getMemberByWallet(
  coopId: string,
  wallet: string,
): Promise<StoredMember | null> {
  if (usePg()) return pg.getMemberByWallet(coopId, wallet);
  return file.getMemberByWallet(coopId, wallet);
}

export async function createCooperative(
  input: CreateCoopInput,
  founderWallet: string,
): Promise<{ coop: StoredCooperative; member: StoredMember; created: boolean }> {
  if (usePg()) return pg.createCooperative(input, founderWallet);
  return file.createCooperative(input, founderWallet);
}

/** Bind an isolated CooperativeTreasuryVault address to a cooperative. */
export async function setCooperativeTreasuryVault(
  coopId: string,
  treasuryVaultAddress: string,
): Promise<StoredCooperative | null> {
  if (usePg()) return pg.setCooperativeTreasuryVault(coopId, treasuryVaultAddress);
  return file.setCooperativeTreasuryVault(coopId, treasuryVaultAddress);
}

export async function setCooperativeLoanPool(
  coopId: string,
  loanPoolAddress: string,
): Promise<StoredCooperative | null> {
  if (usePg()) return pg.setCooperativeLoanPool(coopId, loanPoolAddress);
  return file.setCooperativeLoanPool(coopId, loanPoolAddress);
}

export async function setCooperativeOnchainAddresses(
  coopId: string,
  addrs: { treasuryVaultAddress?: string | null; loanPoolAddress?: string | null },
): Promise<StoredCooperative | null> {
  if (usePg()) return pg.setCooperativeOnchainAddresses(coopId, addrs);
  return file.setCooperativeOnchainAddresses(coopId, addrs);
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
  if (usePg()) return pg.joinCooperative(inviteCode, wallet, displayName, email);
  return file.joinCooperative(inviteCode, wallet, displayName, email);
}

export async function activateCooperative(
  coopId: string,
  requesterWallet: string,
): Promise<StoredCooperative> {
  if (usePg()) return pg.activateCooperative(coopId, requesterWallet);
  return file.activateCooperative(coopId, requesterWallet);
}

export async function getCooperativeSummary(coopId: string) {
  if (usePg()) return pg.getCooperativeSummary(coopId);
  return file.getCooperativeSummary(coopId);
}

export async function hydrateForWallet(wallet: string): Promise<{
  cooperatives: StoredCooperative[];
  membersByCoop: Record<string, StoredMember[]>;
}> {
  if (usePg()) return pg.hydrateForWallet(wallet);
  const cooperatives = file.listCooperativesForWallet(wallet);
  const membersByCoop: Record<string, StoredMember[]> = {};
  for (const c of cooperatives) {
    membersByCoop[c.id] = file.getMembers(c.id);
  }
  return { cooperatives, membersByCoop };
}

// ── Transactions ───────────────────────────────────────────────────────────────

export async function listTransactions(opts: {
  coopId?: string;
  wallet?: string;
  limit?: number;
}): Promise<StoredTransaction[]> {
  if (usePg()) return pg.listTransactions(opts);
  return file.listTransactions(opts);
}

export async function recordTransaction(input: {
  coopId: string;
  walletIdentity: string;
  type: TxType;
  amount: number;
  note?: string;
}): Promise<StoredTransaction> {
  if (usePg()) return pg.recordTransaction(input);
  return file.recordTransaction(input);
}

export async function getTreasurySnapshot(coopId: string) {
  if (usePg()) return pg.getTreasurySnapshot(coopId);
  return file.getTreasurySnapshot(coopId);
}

// ── On-chain ───────────────────────────────────────────────────────────────────

export async function findOnchainTransfer(
  key: string,
): Promise<StoredOnchainTransfer | null> {
  if (usePg()) return pg.findOnchainTransfer(key);
  return file.findOnchainTransfer(key);
}

export async function ingestOnchainTransfer(
  input: IngestOnchainInput,
): Promise<{ transfer: StoredOnchainTransfer; created: boolean }> {
  if (usePg()) return pg.ingestOnchainTransfer(input);
  return file.ingestOnchainTransfer(input);
}

export async function listOnchainTransfers(
  wallet: string,
  limit = 50,
): Promise<StoredOnchainTransfer[]> {
  if (usePg()) return pg.listOnchainTransfers(wallet, limit);
  return file.listOnchainTransfers(wallet, limit);
}

/** Public platform metrics for landing page (no auth). */
export async function getPlatformStats(): Promise<PlatformStats> {
  if (usePg()) return pg.getPlatformStats();
  return file.getPlatformStats();
}

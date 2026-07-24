/**
 * Domain-level notification helpers — create rows + SSE fan-out.
 */

import {
  createNotification,
  createNotifications,
  getMembers,
  type CreateNotificationInput,
  type NotifType,
  type StoredCooperative,
  type StoredTransaction,
  type StoredNotification,
} from "./store";
import { publishMany, publishNotification } from "./events";

function uniqueWallets(wallets: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of wallets) {
    const k = w.toLowerCase();
    if (!w || seen.has(k)) continue;
    seen.add(k);
    out.push(w);
  }
  return out;
}

function formatMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function shortWallet(w: string): string {
  if (w.length < 10) return w || "member";
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

async function emit(inputs: CreateNotificationInput[]): Promise<StoredNotification[]> {
  const created = await createNotifications(inputs);
  publishMany(created);
  return created;
}

export async function notifyCoopCreated(
  coop: StoredCooperative,
  founderWallet: string,
): Promise<StoredNotification[]> {
  return emit([
    {
      recipientWallet: founderWallet,
      coopId: coop.id,
      type: "member",
      title: "Cooperative created",
      description: `You founded ${coop.name}. Invite code: ${coop.inviteCode}`,
      actionLabel: "Open cooperative",
      actionHref: "/dashboard/cooperatives",
      metadata: { event: "coop.created", inviteCode: coop.inviteCode },
    },
  ]);
}

export async function notifyMemberJoined(
  coop: StoredCooperative,
  joinerWallet: string,
  joinerName?: string,
  joinPosition?: number,
): Promise<StoredNotification[]> {
  const label = joinerName?.trim() || shortWallet(joinerWallet);
  const members = await getMembers(coop.id);
  const inputs: CreateNotificationInput[] = [];
  const posLabel =
    typeof joinPosition === "number" && joinPosition > 0
      ? ` Payout Position #${joinPosition}.`
      : "";

  inputs.push({
    recipientWallet: joinerWallet,
    coopId: coop.id,
    type: "member",
    title: "Welcome to the cooperative",
    description: `You joined ${coop.name}.${posLabel}${
      joinPosition
        ? ` You will receive the pooled contribution during Cycle ${joinPosition}.`
        : ""
    }`,
    actionLabel: "View workspace",
    actionHref: "/dashboard/cooperatives",
    metadata: {
      event: "coop.joined",
      joinPosition: joinPosition ?? null,
    },
  });

  for (const m of members) {
    if (m.walletIdentity.toLowerCase() === joinerWallet.toLowerCase()) continue;
    if (m.status !== "active") continue;
    inputs.push({
      recipientWallet: m.walletIdentity,
      coopId: coop.id,
      type: "member",
      title: "New member joined",
      description: `${label} joined ${coop.name}${
        joinPosition ? ` as Position #${joinPosition}` : ""
      }.`,
      actionLabel: "View members",
      actionHref: "/dashboard/members",
      metadata: {
        event: "coop.member_joined",
        joinerWallet,
        joinPosition: joinPosition ?? null,
      },
    });
  }

  return emit(inputs);
}

export async function notifyCoopActivated(
  coop: StoredCooperative,
  actorWallet: string,
): Promise<StoredNotification[]> {
  const members = await getMembers(coop.id);
  const inputs: CreateNotificationInput[] = members
    .filter((m) => m.status === "active")
    .map((m) => ({
      recipientWallet: m.walletIdentity,
      coopId: coop.id,
      type: "member" as NotifType,
      title: "Cooperative started",
      description: `${coop.name} is now Active. Joining is closed and the payout order is locked.`,
      actionLabel: "View cooperative",
      actionHref: "/dashboard/cooperatives",
      metadata: {
        event: "coop.activated",
        actorWallet,
        currentRecipientPosition: coop.currentRecipientPosition ?? 1,
      },
    }));
  return emit(inputs);
}

export async function notifyTransaction(
  coop: StoredCooperative,
  tx: StoredTransaction,
): Promise<StoredNotification[]> {
  const money = formatMoney(tx.amount, tx.currency || coop.currency || "USD");
  const actor = shortWallet(tx.walletIdentity);
  const members = await getMembers(coop.id);

  let type: NotifType;
  let title: string;
  let descriptionActor: string;
  let descriptionOthers: string;
  let actionLabel: string;

  if (tx.type === "withdrawal") {
    type = "withdrawal";
    title = "Withdrawal recorded";
    descriptionActor = `You withdrew ${money} from ${coop.name}.`;
    descriptionOthers = `${actor} withdrew ${money} from ${coop.name}.`;
    actionLabel = "View treasury";
  } else {
    type = tx.type === "contribution" ? "contribution" : "deposit";
    title = tx.type === "contribution" ? "Contribution received" : "Deposit received";
    descriptionActor = `You deposited ${money} into ${coop.name}.`;
    descriptionOthers = `${actor} deposited ${money} into ${coop.name}.`;
    actionLabel = "View treasury";
  }

  const wallets = uniqueWallets(members.map((m) => m.walletIdentity));
  const inputs: CreateNotificationInput[] = wallets.map((wallet) => {
    const isActor = wallet.toLowerCase() === tx.walletIdentity.toLowerCase();
    return {
      recipientWallet: wallet,
      coopId: coop.id,
      type,
      title,
      description: isActor ? descriptionActor : descriptionOthers,
      actionLabel,
      actionHref: "/dashboard/treasury",
      metadata: {
        event: `tx.${tx.type}`,
        txId: tx.id,
        amount: tx.amount,
        currency: tx.currency,
      },
    };
  });

  return emit(inputs);
}

export async function notifyEvent(
  recipients: string[],
  payload: Omit<CreateNotificationInput, "recipientWallet">,
): Promise<StoredNotification[]> {
  const inputs = uniqueWallets(recipients).map((recipientWallet) => ({
    ...payload,
    recipientWallet,
  }));
  return emit(inputs);
}

export async function notifySingle(
  input: CreateNotificationInput,
): Promise<StoredNotification> {
  const n = await createNotification(input);
  publishNotification(n);
  return n;
}

function formatUsdc(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(amount);
}

function shortAddr(w: string): string {
  if (!w || w.length < 10) return w || "unknown";
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

export async function notifyOnchainTransfer(input: {
  wallet: string;
  direction: "in" | "out";
  amount: number;
  counterparty?: string;
  txHash: string;
  explorerUrl?: string;
  token?: "usdc-erc20" | "usdc-native";
}): Promise<StoredNotification> {
  const money = formatUsdc(input.amount);
  const peer = shortAddr(input.counterparty ?? "");
  const tokenLabel =
    input.token === "usdc-native" ? "native USDC" : "USDC";
  const href =
    input.explorerUrl ??
    (input.txHash ? `https://testnet.arcscan.app/tx/${input.txHash}` : undefined);

  if (input.direction === "in") {
    return notifySingle({
      recipientWallet: input.wallet,
      type: "deposit",
      title: "USDC received on Arc",
      description: peer
        ? `You received ${money} ${tokenLabel} from ${peer} on Arc Testnet.`
        : `You received ${money} ${tokenLabel} on Arc Testnet.`,
      actionLabel: "View on explorer",
      actionHref: href,
      metadata: {
        event: "onchain.deposit",
        txHash: input.txHash,
        amount: input.amount,
        counterparty: input.counterparty,
        network: "arc-testnet",
      },
    });
  }

  return notifySingle({
    recipientWallet: input.wallet,
    type: "withdrawal",
    title: "USDC sent on Arc",
    description: peer
      ? `You sent ${money} ${tokenLabel} to ${peer} on Arc Testnet.`
      : `You sent ${money} ${tokenLabel} on Arc Testnet.`,
    actionLabel: "View on explorer",
    actionHref: href,
    metadata: {
      event: "onchain.withdrawal",
      txHash: input.txHash,
      amount: input.amount,
      counterparty: input.counterparty,
      network: "arc-testnet",
    },
  });
}

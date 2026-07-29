/**
 * On-chain Arc USDC transfer ingestion → notifications.
 * Mounted at /api/onchain
 */

import { Router, type IRouter, type Request, type Response } from "express";
import {
  ingestOnchainTransfer,
  listOnchainTransfers,
} from "../lib/store";
import { notifyOnchainTransfer } from "../lib/notify";
import { scanWalletTransfers } from "../lib/arc-scan";
import { requireWallet } from "../lib/wallet";
import {
  bootstrapVaultMember,
  vaultOperatorConfigured,
} from "../lib/vault-operator";

const router: IRouter = Router();

function sendError(res: Response, e: unknown): void {
  const status =
    e && typeof e === "object" && "status" in e && typeof (e as { status: unknown }).status === "number"
      ? (e as { status: number }).status
      : 500;
  const message = e instanceof Error ? e.message : "Request failed";
  res.status(status).json({ error: message });
}

// GET /api/onchain/transfers
router.get("/transfers", async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req);
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    res.json({
      transfers: await listOnchainTransfers(
        wallet,
        Number.isFinite(limit) ? limit : 50,
      ),
    });
  } catch (e) {
    sendError(res, e);
  }
});

/**
 * POST /api/onchain/sync
 * Server-side Arcscan pull for the connected wallet → notifications.
 * Call this on dashboard load and every ~15s while connected.
 */
router.post("/sync", async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req);
    const detected = await scanWalletTransfers(wallet);

    const notifyAfter = Date.now() - 48 * 60 * 60 * 1000;

    let created = 0;
    let recorded = 0;
    const results: Array<{
      txHash: string;
      created: boolean;
      notified: boolean;
      amount: number;
      direction: string;
    }> = [];

    for (const t of detected) {
      const { transfer, created: isNew } = await ingestOnchainTransfer({
        txHash: t.txHash,
        logIndex: t.logIndex,
        wallet,
        direction: t.direction,
        amount: t.amount,
        token: t.token,
        counterparty: t.counterparty,
        blockNumber: t.blockNumber,
        explorerUrl: t.explorerUrl,
        timestamp: t.timestamp,
      });

      let notified = false;
      if (isNew) {
        recorded += 1;
        const ts = t.timestamp ? new Date(t.timestamp).getTime() : Date.now();
        const isRecent = Number.isFinite(ts) && ts >= notifyAfter;
        if (isRecent) {
          await notifyOnchainTransfer({
            wallet,
            direction: transfer.direction,
            amount: transfer.amount,
            counterparty: transfer.counterparty,
            txHash: transfer.txHash,
            explorerUrl: transfer.explorerUrl,
            token: transfer.token,
          });
          created += 1;
          notified = true;
        }
      }

      results.push({
        txHash: transfer.txHash,
        created: isNew,
        notified,
        amount: transfer.amount,
        direction: transfer.direction,
      });
    }

    res.json({
      scanned: detected.length,
      recorded,
      created,
      results,
    });
  } catch (e) {
    sendError(res, e);
  }
});

/**
 * POST /api/onchain/transfers
 * Body: single transfer or { transfers: [...] }
 * Deduped by txHash+logIndex. Creates deposit/withdrawal notifications for new ones.
 */
router.post("/transfers", async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req);
    const body = req.body as {
      transfers?: Array<Record<string, unknown>>;
      txHash?: string;
      logIndex?: number | null;
      direction?: "in" | "out";
      amount?: number;
      token?: "usdc-erc20" | "usdc-native";
      counterparty?: string;
      blockNumber?: number;
      explorerUrl?: string;
      timestamp?: string;
      wallet?: string;
    };

    const rawList = Array.isArray(body.transfers)
      ? body.transfers
      : body.txHash
        ? [body]
        : [];

    if (rawList.length === 0) {
      res.status(400).json({ error: "Provide transfers[] or a single transfer object" });
      return;
    }

    const results: Array<{
      key: string;
      created: boolean;
      transfer: unknown;
      notificationId?: string;
    }> = [];

    for (const item of rawList) {
      const txHash = String(item.txHash ?? "");
      const direction = item.direction === "out" ? "out" : "in";
      const amount = Number(item.amount);
      const itemWallet = String(item.wallet ?? wallet);

      if (itemWallet.toLowerCase() !== wallet.toLowerCase()) {
        continue;
      }

      const { transfer, created } = await ingestOnchainTransfer({
        txHash,
        logIndex:
          typeof item.logIndex === "number"
            ? item.logIndex
            : item.logIndex === null
              ? null
              : undefined,
        wallet: itemWallet,
        direction,
        amount,
        token: item.token === "usdc-native" ? "usdc-native" : "usdc-erc20",
        counterparty:
          typeof item.counterparty === "string" ? item.counterparty : undefined,
        blockNumber:
          typeof item.blockNumber === "number" ? item.blockNumber : undefined,
        explorerUrl:
          typeof item.explorerUrl === "string" ? item.explorerUrl : undefined,
        timestamp:
          typeof item.timestamp === "string" ? item.timestamp : undefined,
      });

      let notificationId: string | undefined;
      if (created) {
        const notif = await notifyOnchainTransfer({
          wallet: itemWallet,
          direction,
          amount: transfer.amount,
          counterparty: transfer.counterparty,
          txHash: transfer.txHash,
          explorerUrl: transfer.explorerUrl,
          token: transfer.token,
        });
        notificationId = notif.id;
      }

      results.push({
        key: transfer.key,
        created,
        transfer,
        notificationId,
      });
    }

    res.status(200).json({
      processed: results.length,
      created: results.filter((r) => r.created).length,
      results,
    });
  } catch (e) {
    sendError(res, e);
  }
});

/**
 * GET /api/onchain/vault/operator-status
 * Whether the server can register Circle wallets on the treasury vault.
 */
router.get("/vault/operator-status", (_req: Request, res: Response) => {
  res.json({
    configured: vaultOperatorConfigured(),
    vault:
      process.env.TREASURY_VAULT_ADDRESS?.trim() ||
      process.env.VITE_TREASURY_VAULT_ADDRESS?.trim() ||
      null,
  });
});

/**
 * POST /api/onchain/vault/register
 * Body: { claimOrganizer?: boolean }
 *
 * Registers the caller's Circle wallet (x-wallet-address) on CooperativeTreasuryVault
 * using VAULT_OPERATOR_PRIVATE_KEY (deploy key). Optionally transfers organizer so the
 * Circle founder can register future members and update rules from the app.
 */
router.post("/vault/register", async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req);
    const body = (req.body ?? {}) as { claimOrganizer?: boolean };
    const claimOrganizer = body.claimOrganizer !== false; // default true for founders
    const result = await bootstrapVaultMember({
      member: wallet,
      claimOrganizer,
    });
    res.json(result);
  } catch (e) {
    sendError(res, e);
  }
});

export default router;

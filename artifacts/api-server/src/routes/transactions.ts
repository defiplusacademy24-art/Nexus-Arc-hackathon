/**
 * Treasury transactions — deposits, withdrawals, contributions.
 * Mounted at /api/transactions
 */

import { Router, type IRouter, type Request, type Response } from "express";
import {
  findByInviteCode,
  getCooperative,
  getTreasurySnapshot,
  listTransactions,
  recordTransaction,
  type TxType,
} from "../lib/store";
import { notifyTransaction } from "../lib/notify";
import { requireWallet } from "../lib/wallet";

const router: IRouter = Router();

function sendError(res: Response, e: unknown): void {
  const status =
    e && typeof e === "object" && "status" in e && typeof (e as { status: unknown }).status === "number"
      ? (e as { status: number }).status
      : 500;
  const message = e instanceof Error ? e.message : "Request failed";
  res.status(status).json({ error: message });
}

// GET /api/transactions
router.get("/", async (req: Request, res: Response) => {
  try {
    requireWallet(req);
    const coopId = typeof req.query.coopId === "string" ? req.query.coopId : undefined;
    const wallet =
      typeof req.query.forWallet === "string" ? req.query.forWallet : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const transactions = await listTransactions({
      coopId,
      wallet,
      limit: Number.isFinite(limit) ? limit : 50,
    });
    res.json({ transactions });
  } catch (e) {
    sendError(res, e);
  }
});

// GET /api/transactions/treasury/:coopId
router.get("/treasury/:coopId", async (req: Request, res: Response) => {
  try {
    requireWallet(req);
    const coopId = Array.isArray(req.params.coopId) ? req.params.coopId[0] : req.params.coopId;
    const snapshot = await getTreasurySnapshot(coopId);
    if (!snapshot) {
      res.status(404).json({ error: "Cooperative not found" });
      return;
    }
    res.json({ snapshot });
  } catch (e) {
    sendError(res, e);
  }
});

// POST /api/transactions
router.post("/", async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req);
    const body = req.body as {
      coopId?: string;
      inviteCode?: string;
      type?: string;
      amount?: number;
      note?: string;
    };

    let coopId = body.coopId;
    if (!coopId && body.inviteCode) {
      const found = await findByInviteCode(body.inviteCode);
      if (!found) {
        res.status(404).json({ error: "Cooperative not found for invite code" });
        return;
      }
      coopId = found.id;
    }
    if (!coopId) {
      res.status(400).json({ error: "coopId or inviteCode is required" });
      return;
    }
    const type = (body.type ?? "deposit") as TxType;
    if (!["deposit", "withdrawal", "contribution"].includes(type)) {
      res.status(400).json({ error: "type must be deposit, withdrawal, or contribution" });
      return;
    }
    if (typeof body.amount !== "number") {
      res.status(400).json({ error: "amount must be a number" });
      return;
    }

    const tx = await recordTransaction({
      coopId,
      walletIdentity: wallet,
      type,
      amount: body.amount,
      note: body.note,
    });

    const coop = await getCooperative(coopId);
    let notificationsCreated = 0;
    if (coop) {
      notificationsCreated = (await notifyTransaction(coop, tx)).length;
    }

    const snapshot = await getTreasurySnapshot(coopId);

    res.status(201).json({
      transaction: tx,
      snapshot,
      notificationsCreated,
    });
  } catch (e) {
    sendError(res, e);
  }
});

export default router;

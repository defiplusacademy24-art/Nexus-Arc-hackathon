/**
 * Cooperative create / join / activate / list — emits real-time notifications.
 * Mounted at /api/cooperatives
 */

import { Router, type IRouter, type Request, type Response } from "express";
import {
  activateCooperative,
  createCooperative,
  getCooperative,
  getCooperativeSummary,
  getMembers,
  joinCooperative,
  listCooperativesForWallet,
} from "../lib/store";
import { notifyCoopCreated, notifyMemberJoined, notifyCoopActivated } from "../lib/notify";
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

// GET /api/cooperatives
router.get("/", (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req);
    const cooperatives = listCooperativesForWallet(wallet);
    res.json({ cooperatives });
  } catch (e) {
    sendError(res, e);
  }
});

function paramId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

// GET /api/cooperatives/:id
router.get("/:id", (req: Request, res: Response) => {
  try {
    requireWallet(req);
    const coop = getCooperative(paramId(req));
    if (!coop) {
      res.status(404).json({ error: "Cooperative not found" });
      return;
    }
    res.json({ cooperative: coop });
  } catch (e) {
    sendError(res, e);
  }
});

// GET /api/cooperatives/:id/members
router.get("/:id/members", (req: Request, res: Response) => {
  try {
    requireWallet(req);
    const members = getMembers(paramId(req));
    res.json({ members });
  } catch (e) {
    sendError(res, e);
  }
});

// GET /api/cooperatives/:id/summary
router.get("/:id/summary", (req: Request, res: Response) => {
  try {
    requireWallet(req);
    const summary = getCooperativeSummary(paramId(req));
    if (!summary) {
      res.status(404).json({ error: "Cooperative not found" });
      return;
    }
    res.json({ summary });
  } catch (e) {
    sendError(res, e);
  }
});

// POST /api/cooperatives
router.post("/", (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req);
    const body = req.body as {
      name?: string;
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
      status?: string;
      founderDisplayName?: string;
      founderEmail?: string;
    };

    if (!body.name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const { coop, member, created } = createCooperative(
      {
        name: body.name,
        description: body.description,
        type: body.type,
        country: body.country,
        currency: body.currency,
        contributionAmount: body.contributionAmount,
        contributionFrequency: body.contributionFrequency,
        privacy: body.privacy,
        votingModel: body.votingModel,
        approvalThreshold: body.approvalThreshold,
        loanApprovalPolicy: body.loanApprovalPolicy,
        aiGovernanceEnabled: body.aiGovernanceEnabled,
        maxMembers: body.maxMembers,
        inviteCode: body.inviteCode,
        rotationMode: body.rotationMode,
        status: body.status,
        founderDisplayName: body.founderDisplayName,
        founderEmail: body.founderEmail,
      },
      wallet,
    );

    // Only notify on first creation (avoid spam on idempotent re-sync)
    const notifications = created ? notifyCoopCreated(coop, wallet) : [];

    res.status(created ? 201 : 200).json({
      cooperative: coop,
      member,
      created,
      notificationsCreated: notifications.length,
    });
  } catch (e) {
    sendError(res, e);
  }
});

// POST /api/cooperatives/join
router.post("/join", (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req);
    const body = req.body as {
      inviteCode?: string;
      displayName?: string;
      email?: string;
    };

    if (!body.inviteCode?.trim()) {
      res.status(400).json({ error: "inviteCode is required" });
      return;
    }

    const { coop, member, joined, joinPosition } = joinCooperative(
      body.inviteCode,
      wallet,
      body.displayName,
      body.email,
    );

    const notifications = joined
      ? notifyMemberJoined(coop, wallet, body.displayName, joinPosition)
      : [];

    res.status(200).json({
      cooperative: coop,
      member,
      joined,
      joinPosition,
      notificationsCreated: notifications.length,
      message: joined
        ? `Welcome to the cooperative! You have been assigned Payout Position #${joinPosition}. You will receive the pooled contribution during Cycle ${joinPosition}.`
        : "You are already a member of this cooperative.",
    });
  } catch (e) {
    sendError(res, e);
  }
});

// POST /api/cooperatives/:id/activate — owner starts cooperative
router.post("/:id/activate", (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req);
    const coop = activateCooperative(paramId(req), wallet);
    const notifications = notifyCoopActivated(coop, wallet);
    res.json({
      cooperative: coop,
      notificationsCreated: notifications.length,
      message: "Cooperative is now Active. Joining is closed and payout order is locked.",
    });
  } catch (e) {
    sendError(res, e);
  }
});

export default router;

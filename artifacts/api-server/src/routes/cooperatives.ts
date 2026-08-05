/**
 * Cooperative create / join / activate / list / hydrate — emits real-time notifications.
 * Mounted at /api/cooperatives
 */

import { Router, type IRouter, type Request, type Response } from "express";
import {
  activateCooperative,
  createCooperative,
  getCooperative,
  getCooperativeSummary,
  getMembers,
  hydrateForWallet,
  joinCooperative,
  listCooperativesForWallet,
  setCooperativeOnchainAddresses,
  storageBackend,
} from "../lib/store";
import { notifyCoopCreated, notifyMemberJoined, notifyCoopActivated } from "../lib/notify";
import { requireWallet } from "../lib/wallet";
import {
  loanPoolFactoryConfigured,
  provisionCoopOnchainInfrastructure,
  vaultFactoryConfigured,
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

function paramId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

// GET /api/cooperatives — list for wallet; ?hydrate=1 includes members
router.get("/", async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req);
    const hydrate =
      req.query.hydrate === "1" ||
      req.query.hydrate === "true" ||
      req.query.withMembers === "1" ||
      req.query.withMembers === "true";

    if (hydrate) {
      const data = await hydrateForWallet(wallet);
      res.json({
        ...data,
        storage: storageBackend(),
      });
      return;
    }

    const cooperatives = await listCooperativesForWallet(wallet);
    res.json({ cooperatives, storage: storageBackend() });
  } catch (e) {
    sendError(res, e);
  }
});

// GET /api/cooperatives/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    requireWallet(req);
    const coop = await getCooperative(paramId(req));
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
router.get("/:id/members", async (req: Request, res: Response) => {
  try {
    requireWallet(req);
    const members = await getMembers(paramId(req));
    res.json({ members });
  } catch (e) {
    sendError(res, e);
  }
});

// GET /api/cooperatives/:id/summary
router.get("/:id/summary", async (req: Request, res: Response) => {
  try {
    requireWallet(req);
    const summary = await getCooperativeSummary(paramId(req));
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
router.post("/", async (req: Request, res: Response) => {
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

    let { coop, member, created } = await createCooperative(
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

    // Provision isolated vault + loan pool (30% auto-fund) for this workspace only.
    let onchain: {
      vault: string;
      loanPool: string | null;
      message: string;
    } | null = null;
    let vaultError: string | null = null;
    if (
      created &&
      (!coop.treasuryVaultAddress || !coop.loanPoolAddress) &&
      vaultFactoryConfigured()
    ) {
      try {
        const provisioned = await provisionCoopOnchainInfrastructure({
          coopId: coop.id,
          name: coop.name,
          contributionAmountUsd: coop.contributionAmount || 10,
          contributionFrequency: coop.contributionFrequency,
          existingVaultAddress: coop.treasuryVaultAddress,
          existingLoanPoolAddress: coop.loanPoolAddress,
        });
        const updated = await setCooperativeOnchainAddresses(coop.id, {
          treasuryVaultAddress: provisioned.vault,
          loanPoolAddress: provisioned.loanPool,
        });
        if (updated) coop = updated;
        onchain = {
          vault: provisioned.vault,
          loanPool: provisioned.loanPool,
          message: provisioned.message,
        };
      } catch (e) {
        vaultError = e instanceof Error ? e.message : "On-chain provision failed";
        // Coop still created off-chain; client can retry POST .../vault
      }
    }

    const notifications = created ? await notifyCoopCreated(coop, wallet) : [];

    res.status(created ? 201 : 200).json({
      cooperative: coop,
      member,
      created,
      onchain,
      vaultDeploy: onchain
        ? { vault: onchain.vault, loanPool: onchain.loanPool, alreadyExisted: false }
        : null,
      vaultError,
      notificationsCreated: notifications.length,
      storage: storageBackend(),
    });
  } catch (e) {
    sendError(res, e);
  }
});

// POST /api/cooperatives/join
router.post("/join", async (req: Request, res: Response) => {
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

    const { coop, member, joined, joinPosition } = await joinCooperative(
      body.inviteCode,
      wallet,
      body.displayName,
      body.email,
    );

    const notifications = joined
      ? await notifyMemberJoined(coop, wallet, body.displayName, joinPosition)
      : [];

    res.status(200).json({
      cooperative: coop,
      member,
      joined,
      joinPosition,
      notificationsCreated: notifications.length,
      storage: storageBackend(),
      message: joined
        ? `Welcome to the cooperative! You have been assigned Payout Position #${joinPosition}. You will receive the pooled contribution during Cycle ${joinPosition}.`
        : "You are already a member of this cooperative.",
    });
  } catch (e) {
    sendError(res, e);
  }
});

/**
 * POST /api/cooperatives/:id/vault
 * Deploy (or re-bind) isolated treasury vault + loan pool for this workspace.
 * Wires vault.setLendingPool so 30% of deposits fund this coop's loan pool only.
 * Idempotent when factories already indexed the coop id.
 */
router.post("/:id/vault", async (req: Request, res: Response) => {
  try {
    requireWallet(req);
    const coopId = paramId(req);
    const existing = await getCooperative(coopId);
    if (!existing) {
      res.status(404).json({ error: "Cooperative not found" });
      return;
    }

    if (existing.treasuryVaultAddress && existing.loanPoolAddress) {
      res.json({
        cooperative: existing,
        vault: existing.treasuryVaultAddress,
        loanPool: existing.loanPoolAddress,
        alreadyExisted: true,
        message:
          "Cooperative already has an isolated treasury vault and loan pool.",
      });
      return;
    }

    if (!vaultFactoryConfigured() && !existing.treasuryVaultAddress) {
      res.status(503).json({
        error:
          "Vault factory not configured. Set TREASURY_VAULT_FACTORY_ADDRESS and VAULT_OPERATOR_PRIVATE_KEY, then retry.",
      });
      return;
    }

    if (
      existing.treasuryVaultAddress &&
      !existing.loanPoolAddress &&
      !loanPoolFactoryConfigured()
    ) {
      res.status(503).json({
        error:
          "Loan pool factory not configured. Set LOAN_POOL_FACTORY_ADDRESS and VAULT_OPERATOR_PRIVATE_KEY.",
      });
      return;
    }

    const provisioned = await provisionCoopOnchainInfrastructure({
      coopId: existing.id,
      name: existing.name,
      contributionAmountUsd: existing.contributionAmount || 10,
      contributionFrequency: existing.contributionFrequency,
      existingVaultAddress: existing.treasuryVaultAddress,
      existingLoanPoolAddress: existing.loanPoolAddress,
    });
    const coop = await setCooperativeOnchainAddresses(existing.id, {
      treasuryVaultAddress: provisioned.vault,
      loanPoolAddress: provisioned.loanPool,
    });
    res.status(existing.treasuryVaultAddress ? 200 : 201).json({
      cooperative: coop,
      vault: provisioned.vault,
      loanPool: provisioned.loanPool,
      alreadyExisted: Boolean(existing.treasuryVaultAddress && existing.loanPoolAddress),
      message: provisioned.message,
      loanPoolFactoryConfigured: loanPoolFactoryConfigured(),
    });
  } catch (e) {
    sendError(res, e);
  }
});

// POST /api/cooperatives/:id/activate — owner starts cooperative
router.post("/:id/activate", async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req);
    const coop = await activateCooperative(paramId(req), wallet);
    const notifications = await notifyCoopActivated(coop, wallet);
    res.json({
      cooperative: coop,
      notificationsCreated: notifications.length,
      message: "Cooperative is now Active. Joining is closed and payout order is locked.",
      storage: storageBackend(),
    });
  } catch (e) {
    sendError(res, e);
  }
});

export default router;

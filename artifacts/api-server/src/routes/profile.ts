/**
 * User profile REST API (display name, avatar prefs).
 * Mounted at /api/profile — requires x-wallet-address.
 * Persists to Postgres when DATABASE_URL is set so names sync across devices.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { getUserProfile, upsertUserProfile, storageBackend } from "../lib/store";
import { requireWallet } from "../lib/wallet";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function sendError(res: Response, e: unknown): void {
  const status =
    e && typeof e === "object" && "status" in e && typeof (e as { status: unknown }).status === "number"
      ? (e as { status: number }).status
      : 500;
  const message = e instanceof Error ? e.message : "Request failed";
  res.status(status).json({ error: message });
}

function toApiPrefs(profile: {
  displayName: string;
  avatarColor: string;
  avatarEmoji: string;
  avatarUrl: string;
  language: string;
  timezone: string;
  notifPrefs: {
    contributions: boolean;
    loans: boolean;
    governance: boolean;
    security: boolean;
    aiInsights: boolean;
  };
  updatedAt: string;
}) {
  return {
    displayNameOverride: profile.displayName,
    avatarColor: profile.avatarColor,
    avatarEmoji: profile.avatarEmoji,
    avatarUrl: profile.avatarUrl,
    language: profile.language,
    timezone: profile.timezone,
    notifPrefs: profile.notifPrefs,
    updatedAt: profile.updatedAt,
  };
}

/** GET /api/profile — load prefs for the connected wallet */
router.get("/", async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req);
    const profile = await getUserProfile(wallet);
    res.json({
      wallet: wallet.toLowerCase(),
      storage: storageBackend(),
      profile: profile
        ? toApiPrefs(profile)
        : null,
    });
  } catch (e) {
    sendError(res, e);
  }
});

/** PUT /api/profile — upsert prefs (display name, avatar, language, …) */
router.put("/", async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req);
    const body = (req.body ?? {}) as {
      displayNameOverride?: string;
      displayName?: string;
      avatarColor?: string;
      avatarEmoji?: string;
      avatarUrl?: string;
      language?: string;
      timezone?: string;
      notifPrefs?: Partial<{
        contributions: boolean;
        loans: boolean;
        governance: boolean;
        security: boolean;
        aiInsights: boolean;
      }>;
    };

    const displayName =
      typeof body.displayNameOverride === "string"
        ? body.displayNameOverride
        : typeof body.displayName === "string"
          ? body.displayName
          : undefined;

    // Guard oversized avatars (data URLs); client resizes to ~256px
    if (typeof body.avatarUrl === "string" && body.avatarUrl.length > 600_000) {
      res.status(400).json({
        error: "Avatar image is too large. Use a smaller photo.",
      });
      return;
    }

    const profile = await upsertUserProfile(wallet, {
      displayName,
      avatarColor: body.avatarColor,
      avatarEmoji: body.avatarEmoji,
      avatarUrl: body.avatarUrl,
      language: body.language,
      timezone: body.timezone,
      notifPrefs: body.notifPrefs,
    });

    logger.info(
      {
        wallet: wallet.toLowerCase(),
        displayName: profile.displayName,
        storage: storageBackend(),
      },
      "user profile saved",
    );

    res.json({
      wallet: wallet.toLowerCase(),
      storage: storageBackend(),
      profile: toApiPrefs(profile),
    });
  } catch (e) {
    logger.error({ err: e }, "profile upsert failed");
    sendError(res, e);
  }
});

export default router;

/**
 * Public platform metrics — no wallet required.
 * Used by the marketing landing page for live network stats.
 * Mounted at /api/platform
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { getPlatformStats } from "../lib/store";

const router: IRouter = Router();

// Cache briefly so cold-start landings don't hammer Postgres.
let cache: { at: number; body: unknown } | null = null;
const CACHE_MS = 15_000;

// GET /api/platform/stats
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const now = Date.now();
    if (cache && now - cache.at < CACHE_MS) {
      res.setHeader("Cache-Control", "public, max-age=15, s-maxage=15");
      res.setHeader("X-Stats-Cache", "HIT");
      res.json(cache.body);
      return;
    }

    const stats = await getPlatformStats();
    const body = {
      cooperatives: stats.cooperatives,
      activeCooperatives: stats.activeCooperatives,
      members: stats.members,
      agentsRunning: stats.agentsRunning,
      agentsTotal: stats.agentsTotal,
      transactions: stats.transactions,
      storage: stats.storage,
      updatedAt: stats.updatedAt,
    };
    cache = { at: now, body };
    res.setHeader("Cache-Control", "public, max-age=15, s-maxage=15");
    res.setHeader("X-Stats-Cache", "MISS");
    res.json(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load platform stats";
    res.status(500).json({
      error: message,
      cooperatives: 0,
      activeCooperatives: 0,
      members: 0,
      agentsRunning: 0,
      agentsTotal: 0,
      transactions: 0,
    });
  }
});

export default router;

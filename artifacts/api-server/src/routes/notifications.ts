/**
 * Notifications REST + SSE stream.
 * Mounted at /api/notifications
 */

import { Router, type IRouter, type Request, type Response } from "express";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadCount,
} from "../lib/store";
import { subscribe } from "../lib/events";
import { requireWallet, resolveWallet } from "../lib/wallet";

const router: IRouter = Router();

function sendError(res: Response, e: unknown): void {
  const status =
    e && typeof e === "object" && "status" in e && typeof (e as { status: unknown }).status === "number"
      ? (e as { status: number }).status
      : 500;
  const message = e instanceof Error ? e.message : "Request failed";
  res.status(status).json({ error: message });
}

/** Map store notification → API shape matching frontend AppNotification */
function toApi(n: {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  actionLabel?: string;
  actionHref?: string;
  coopId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    description: n.description,
    timestamp: n.timestamp,
    read: n.read,
    actionLabel: n.actionLabel,
    actionHref: n.actionHref,
    coopId: n.coopId ?? null,
    metadata: n.metadata,
  };
}

// GET /api/notifications
router.get("/", async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req);
    const unreadOnly =
      req.query.unread === "true" || req.query.unread === "1";
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const items = (
      await listNotifications({
        wallet,
        unreadOnly,
        limit: Number.isFinite(limit) ? limit : 100,
      })
    ).map(toApi);
    res.json({
      notifications: items,
      unreadCount: await unreadCount(wallet),
    });
  } catch (e) {
    sendError(res, e);
  }
});

// GET /api/notifications/unread-count
router.get("/unread-count", async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req);
    res.json({ count: await unreadCount(wallet) });
  } catch (e) {
    sendError(res, e);
  }
});

// GET /api/notifications/stream — Server-Sent Events
router.get("/stream", async (req: Request, res: Response) => {
  try {
    const wallet = resolveWallet(req);
    if (!wallet) {
      res.status(401).json({ error: "Wallet address required" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const write = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    write("connected", { wallet, at: new Date().toISOString() });
    write("unread", { count: await unreadCount(wallet) });

    const unsub = subscribe(wallet, (evt) => {
      write("notification", toApi(evt.notification));
      void unreadCount(wallet).then((count) => {
        write("unread", { count });
      });
    });

    const heartbeat = setInterval(() => {
      res.write(`: ping ${Date.now()}\n\n`);
    }, 25_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsub();
    });
  } catch (e) {
    sendError(res, e);
  }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const notif = await markNotificationRead(id, wallet);
    if (!notif) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }
    res.json({
      notification: toApi(notif),
      unreadCount: await unreadCount(wallet),
    });
  } catch (e) {
    sendError(res, e);
  }
});

// POST /api/notifications/read-all
router.post("/read-all", async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req);
    const updated = await markAllNotificationsRead(wallet);
    res.json({ updated, unreadCount: 0 });
  } catch (e) {
    sendError(res, e);
  }
});

export default router;

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import circleUcRouter from "./circle-uc";
import notificationsRouter from "./notifications";
import cooperativesRouter from "./cooperatives";
import transactionsRouter from "./transactions";
import onchainRouter from "./onchain";
import platformRouter from "./platform";
import agentsRouter from "./agents";
import { ucEnabled } from "../lib/circle-user";
import { logger } from "../lib/logger";
import { storageBackend } from "../lib/store";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/uc", circleUcRouter);
router.use("/notifications", notificationsRouter);
router.use("/cooperatives", cooperativesRouter);
router.use("/transactions", transactionsRouter);
router.use("/onchain", onchainRouter);
router.use("/platform", platformRouter);
router.use("/agents", agentsRouter);

logger.info(
  {
    storage: storageBackend(),
  },
  "Domain APIs enabled: /api/platform, /api/notifications, /api/cooperatives, /api/transactions, /api/onchain, /api/agents",
);

if (ucEnabled()) {
  logger.info(
    "Circle user-controlled wallets enabled at /api/uc/* (email OTP + PIN)",
  );
} else {
  logger.info(
    "Circle user-controlled wallets disabled — set CIRCLE_UC_API_KEY",
  );
}

export default router;

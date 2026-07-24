import { Router, type IRouter } from "express";
import healthRouter from "./health";
import circleUcRouter from "./circle-uc";
import notificationsRouter from "./notifications";
import cooperativesRouter from "./cooperatives";
import transactionsRouter from "./transactions";
import onchainRouter from "./onchain";
import { ucEnabled } from "../lib/circle-user";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/uc", circleUcRouter);
router.use("/notifications", notificationsRouter);
router.use("/cooperatives", cooperativesRouter);
router.use("/transactions", transactionsRouter);
router.use("/onchain", onchainRouter);

import { storageBackend } from "../lib/store";

logger.info(
  {
    storage: storageBackend(),
  },
  "Domain APIs enabled: /api/notifications, /api/cooperatives, /api/transactions, /api/onchain",
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

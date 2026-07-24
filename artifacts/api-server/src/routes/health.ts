import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { storageBackend } from "../lib/store";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json({
    ...data,
    storage: storageBackend(),
  });
});

export default router;

import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { agentConfig } from './agents/config';
import { agentRuntime } from './agents/runtime';
import { startChainListeners } from './agents/chain-listener';

// Local / long-running process only. On Vercel the Express app is exported
// from api/index.ts and never calls listen().
const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  if (agentConfig.enabled) {
    try { await agentRuntime().start(); startChainListeners(agentRuntime()); }
    catch (agentError) { logger.fatal({ err: agentError }, 'Agent runtime failed to start'); process.exit(1); }
  }
});

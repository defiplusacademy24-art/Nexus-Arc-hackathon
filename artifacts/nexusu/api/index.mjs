/**
 * Vercel serverless entry for the Express API.
 *
 * Set Vercel Root Directory to `artifacts/nexusu` so this file is deployed as /api.
 * build:vercel compiles api-server and copies the bundle into `.vercel-api/`.
 * vercel.json rewrites /api/* here so Express (mounted at /api) handles routes
 * the same way as local `pnpm --filter @workspace/api-server run dev`.
 *
 * Note: any agent/LLM change in api-server must also touch this tree (or
 * vercel.json) so Vercel rebuilds the nexusu project — ignore filters skip
 * deploys when only artifacts/api-server changes.
 *
 * Redeploy bump: claude-opus-5 OpenRouter model mapping.
 */
export { default } from "../.vercel-api/app.mjs";

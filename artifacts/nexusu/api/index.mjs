/**
 * Vercel serverless entry for the Express API.
 *
 * Set Vercel Root Directory to `artifacts/nexusu` so this file is deployed as /api.
 * build:vercel compiles api-server and copies the bundle into `.vercel-api/`.
 * vercel.json rewrites /api/* here so Express (mounted at /api) handles routes
 * the same way as local `pnpm --filter @workspace/api-server run dev`.
 */
export { default } from "../.vercel-api/app.mjs";

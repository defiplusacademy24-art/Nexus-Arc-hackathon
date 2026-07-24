/**
 * Vercel serverless entry for the Express API.
 *
 * build:vercel compiles artifacts/api-server → dist/app.mjs first.
 * vercel.json rewrites /api/* here so Express (mounted at /api) handles routes
 * the same way as local `pnpm --filter @workspace/api-server run dev`.
 */
export { default } from "../artifacts/api-server/dist/app.mjs";

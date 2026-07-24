/**
 * Legacy monorepo-root Vercel entry (kept for local/import paths).
 *
 * Production Vercel deploy uses Root Directory `artifacts/nexusu` and
 * `artifacts/nexusu/api/index.mjs` instead (see that file + vercel.json there).
 *
 * build:vercel compiles artifacts/api-server → dist/app.mjs first.
 */
export { default } from "../artifacts/api-server/dist/app.mjs";

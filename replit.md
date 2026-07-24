# Nexusu

Nexusu is a Cooperative OS — a web app that empowers savings groups to operate as autonomous financial institutions with AI governance, programmable money, and secure digital infrastructure, built on the Unicity network.

## Run & Operate

- `pnpm --filter @workspace/nexusu run dev` — run the frontend (port 24670, served at `/`)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, served at `/api`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm run build:vercel` — production build for Vercel (API bundle + frontend static)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Deploy (Vercel)

- Root `vercel.json` builds the SPA (`artifacts/nexusu/dist/public`) and Express as `/api` serverless (`api/index.mjs` → prebuilt `dist/app.mjs`)
- Import the Git repo in Vercel; Root Directory = repo root; Framework = Other (config is in `vercel.json`)
- Env vars (Project → Settings → Environment Variables):
  - Build: `VITE_WALLETCONNECT_PROJECT_ID`, `VITE_CIRCLE_UC_APP_ID` (optional)
  - Runtime: `CIRCLE_UC_API_KEY` (and optional `CIRCLE_UC_BLOCKCHAIN`, `CIRCLE_UC_ACCOUNT_TYPE`, `CORS_ORIGIN`)
- Leave `VITE_API_URL` empty so the browser calls same-origin `/api/*`
- File store is ephemeral on serverless (`/tmp`); fine for demos, not durable multi-instance production

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 7 + Tailwind CSS v4 + `wouter` router
- UI: shadcn/ui component library, Radix UI primitives, Framer Motion
- Charts: Recharts
- AI Chat: Pattern-matched scripted responses via `src/services/ai/nexa.ts` (no external API)
- Wallet: `@unicitylabs/sphere-sdk` for Unicity network integration
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle for API), Vite (frontend)

## Where things live

- `artifacts/nexusu/` — React frontend app
  - `src/App.tsx` — router, all routes
  - `src/pages/` — page components (home, onboarding, dashboard/*)
  - `src/components/` — dashboard layout, sidebar, topnav, profile, charts, AI chat
  - `src/services/` — Unicity SDK service abstractions (identity, wallet, payments, governance, messaging, session, assets, profile) + AI + treasury
  - `src/providers/UnicityProvider.tsx` — wallet context provider
  - `src/hooks/` — useIdentity, useWalletAssets, useProfile, useSession, useUnicityWallet
  - `src/lib/demo-data.ts` — 25 members, 4 savings pools, 6 loans, 4 proposals, 10 notifications
- `artifacts/api-server/` — Express backend
- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/` — Drizzle database schema

## Routes

- `/` — Landing page
- `/app` — Wallet connect screen (redirects to `/dashboard` on connect)
- `/dashboard` — Overview
- `/dashboard/cooperatives` — Cooperative management
- `/dashboard/members` — Member directory
- `/dashboard/treasury` — Treasury & cash flow
- `/dashboard/savings` — Savings pools
- `/dashboard/loans` — Loan management
- `/dashboard/nexa` — Nexa AI assistant (full-page chat)
- `/dashboard/governance` — Proposals & voting
- `/dashboard/analytics` — Analytics & charts
- `/dashboard/notifications` — Notifications
- `/dashboard/settings` — Settings
- `/dashboard/wallet` — Wallet details
- `/dashboard/profile` — Identity & profile

## Architecture decisions

- Non-custodial wallet auth means no user DB — all state is local demo data; service abstractions are pure stubs ready for Unicity SDK integration
- Profile prefs (display name, avatar color, language, timezone, notifications) stored in localStorage, separate from wallet identity
- Wallet assets use `sphere_getAssets` via SDK `query()` with graceful fallback to empty state — never invents fake balances
- Chart `data` prop typed as `Array<any>` to avoid TS2322 with typed data arrays
- `react-markdown` required for Nexa AI chat to render markdown responses

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `vite.config.ts` defaults `PORT=5173` and `BASE_PATH=/` when unset (Vercel/CI-friendly); Replit workflows can still inject overrides
- Verify with `pnpm --filter @workspace/nexusu run typecheck`, or `pnpm run build:vercel` for a full production build

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

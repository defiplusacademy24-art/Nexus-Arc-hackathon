---
name: Nexusu Dashboard Architecture
description: Key decisions for the Nexusu Cooperative OS dashboard — routes, layout pattern, AI chat, chart types, service abstractions, and identity/profile module.
---

## Routing
- Landing: `/`, Auth: `/app` → redirects to `/dashboard` on connect (NOT `/onboarding`)
- Dashboard root: `/dashboard` (Overview) + `/dashboard/{cooperatives,members,treasury,savings,loans,nexa,governance,analytics,notifications,settings,wallet,profile}`
- All routes in `src/App.tsx`, wrapped in `UnicityProvider`

## Layout Pattern
- `DashboardLayout` wraps all dashboard pages — it renders Sidebar (desktop fixed) + Sidebar (mobile drawer) + TopNav + main content
- Mobile: bottom nav bar with 5 items; desktop: full 240px sidebar
- Sidebar uses wouter `Link` for navigation; active state via `useLocation()`
- Sidebar bottom section links to `/dashboard/profile` (not `/dashboard/wallet`)
- TopNav avatar links to `/dashboard/profile`

## Identity & Profile Module (/dashboard/profile)
- Services: `services/unicity/assets.ts` (SDK query with graceful empty), `services/unicity/profile.ts` (localStorage prefs)
- Hooks: `useIdentity()`, `useWalletAssets()`, `useProfile()`, `useSession()`
- Components: `components/profile/` — ProfileHeader, IdentityCard, WalletBalanceCard, MemberCard, MemberStats, ActivityTimeline, SecurityCard, PreferencesCard
- Wallet assets: tries `sphere_getAssets` via `query()`, shows empty state with "Testnet — balance queries not yet available" if SDK doesn't support it — NEVER invents fake balances
- Profile prefs (displayName override, avatar color, language, timezone, notifications) stored in localStorage, separate from wallet identity

## Data & Services
- Demo data: `src/lib/demo-data.ts` — 25 members, 4 savings pools, 6 loans, 4 proposals, 10 notifications
- Treasury service: `src/services/treasury/index.ts` — static snapshot + 12-month cash flow history
- AI service: `src/services/ai/nexa.ts` — pattern-matched scripted responses, 7 agent stubs
- Unicity stubs: `src/services/unicity/{payments,governance,messaging}.ts`
- Identity enriched: connectedAt derived from `loadIdentity()` session storage

## Charts
- `recharts` library installed; custom wrappers at `src/components/charts/{AreaChart,BarChart}.tsx`
- Chart component `data` prop typed as `Array<any>` (not `Record<string,unknown>[]`) to avoid TS2322 with typed data arrays

## Nexa AI Chat
- Full page at `/dashboard/nexa` with agent panel on right (xl screens)
- `react-markdown` required for rendering AI markdown responses — must be installed
- Pattern-matching in `getNexaResponse()` function — no external API needed

**Why:** Non-custodial wallet auth means no user DB — all state is local demo data. Service abstractions are pure stubs ready for Unicity SDK integration. Profile prefs are separated from wallet identity so users can personalise without changing on-chain data.

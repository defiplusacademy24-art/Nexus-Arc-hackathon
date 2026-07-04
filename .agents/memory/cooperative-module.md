---
name: Cooperative Module
description: Full cooperative management implementation — services, provider, components, auth model, and known constraints.
---

## Architecture

**Service layer** (`src/services/cooperative/`)
- `cooperative.ts` — CRUD on `nexusu:cooperatives` localStorage key; `findByInviteCode` for join flow
- `members.ts` — per-coop member list at `nexusu:members:{coopId}`; includes `getMemberByWallet`
- `invitations.ts` — `generateInviteCode()`, `generateCoopId()`, `getInviteLink()`, `normaliseCode()`
- `governance.ts` — governance config stored separately at `nexusu:governance:{coopId}`
- `workspace.ts` — active cooperative ID at `nexusu:active-coop`

**Provider** (`src/providers/CooperativeProvider.tsx`)
- Seeds demo data once on first load (checks `loadCooperatives().length > 0`)
- `joinCooperative(inviteCode, walletIdentity?)` — looks up by invite code, checks wallet membership, adds member, switches workspace
- Context type exposes `joinCooperative: (inviteCode: string, walletIdentity?: string) => JoinResult`

**Components** (`src/components/cooperative/`)
- `CreateWizard.tsx` — 4-step modal; pre-generates codes on mount; passes them to service so what's shown is what's stored
- `JoinModal.tsx` — passes `identity?.walletAddress` to `joinCooperative`
- `WorkspaceSwitcher.tsx` — sidebar dropdown; fires `onCreateRequest` / `onJoinRequest` callbacks

## Auth / isManager Rule

In `cooperatives.tsx`, `isManager` is derived ONLY from authenticated wallet:
```ts
const myMembership = currentWallet ? members.find((m) => m.walletIdentity === currentWallet) : null;
const isFounder = Boolean(currentWallet && activeCooperative?.founderWalletIdentity === currentWallet);
const isManager = isFounder || Boolean(myMembership && (myMembership.role === 'founder' || myMembership.role === 'admin'));
```
**Never** falls back to any-admin logic. Settings button and member management controls are gated on this.

**Why:** earlier implementation had `|| (!currentWallet && members.some(...))` fallback that showed admin controls to unauthenticated users.

## Demo Cooperative Behaviour

- Demo coop `founderWalletIdentity` is hardcoded — no real wallet will match, so `isManager = false` for it
- This is correct: the demo coop is a read-only example; users create their own coops to get admin controls
- Settings button DOES appear when a user creates their own cooperative (their wallet is stored as founderWalletIdentity)

## Members Page (`src/pages/dashboard/members.tsx`)

Replaced DEMO_MEMBERS with:
```ts
const { activeCooperative } = useCooperative();
useEffect(() => { setMembers(activeCooperative ? loadCoopMembers(activeCooperative.id) : []); }, [activeCooperative?.id]);
```
Shows cooperative name in subtitle. Renders empty state if no active cooperative.

## Cooperative Settings Panel

- Slide-in drawer from right, 3 tabs: Basic Info | Rules | Governance
- Saves via `updateCooperative(id, updates)` from context
- Cooperative ID + Invite Code shown as read-only (permanent identifiers)
- Only renders when `showSettings && activeCooperative && isManager`

## Known Constraints (demo)

- All cooperatives share one localStorage — "joining" only works for coops created in the same browser session
- QR camera scanning is a placeholder (Sphere Messaging future integration)
- `memberCount` on Cooperative is synced to `loadCoopMembers(id).length` after mutations via `reloadMembers()`

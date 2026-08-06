# Vercel env vars — Circle Agent Wallets (Arc Testnet)

Set these in **Vercel → Project → Settings → Environment Variables** (Production + Preview), then redeploy.

## Required for agents on Vercel

| Variable | Value |
|----------|--------|
| `AGENTS_ENABLED` | `true` |
| `DATABASE_URL` | Your Postgres URL (Neon/Supabase/Vercel Postgres) |
| `CIRCLE_AGENT_WALLET_ADDRESS` | `0x5669a51537e53bc2d3d1c7f0e30491d7bd4468a0` |
| `CIRCLE_UC_API_KEY` | Member email/PIN wallets (already used by app) |
| `CIRCLE_UC_BLOCKCHAIN` | `ARC-TESTNET` |
| `CIRCLE_UC_ACCOUNT_TYPE` | `SCA` |

### LLM — AgentRouter (Claude Code keys from agentrouter.org)

If your key is from [agentrouter.org](https://agentrouter.org) (works with Claude Code as `ANTHROPIC_AUTH_TOKEN`), use **AgentRouter**, not OpenRouter:

| Variable | Value |
|----------|--------|
| `AGENTROUTER_API_KEY` or `OPENAI_API_KEY` or `ANTHROPIC_AUTH_TOKEN` | Your AgentRouter key (`sk-…` from [token console](https://agentrouter.org/console/token)) |
| `AGENTROUTER_BASE_URL` or `OPENAI_BASE_URL` | `https://co.agentrouter.org/v1` (API host; bare `agentrouter.org` hits WAF on Vercel) |
| `AGENTROUTER_MODEL` or `OPENAI_AGENT_MODEL` | e.g. `claude-sonnet-4-5-20250929`, `gpt-4o-mini`, `glm-4.5-air` |
| `LLM_PROVIDER` | `agentrouter` |

**Do not** put an AgentRouter key into OpenRouter env vars with `openrouter.ai` — that always 401s.

Also set for Claude Code parity (optional):

```text
ANTHROPIC_BASE_URL=https://co.agentrouter.org/v1
ANTHROPIC_AUTH_TOKEN=<same key>
```

### LLM — OpenRouter (alternative)

| Variable | Value |
|----------|--------|
| `OPENROUTER_API_KEY` | OpenRouter key only (`sk-or-v1-…` from [openrouter.ai/keys](https://openrouter.ai/keys)) |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` |
| `OPENROUTER_MODEL` | e.g. `openai/gpt-4o-mini`, `anthropic/claude-3.5-sonnet` |
| `LLM_PROVIDER` | `openrouter` |

**Important:**

- OpenRouter keys always start with `sk-or-v1-`. AgentRouter keys look like `sk-VuHa…` and are a different product.
- After changing env vars, **redeploy** Production.

Aliases also accepted: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `XAI_*`.

Agents use **chat.completions** (OpenAI-compatible).

## Recommended (contracts + multi-workspace)

| Variable | Example |
|----------|---------|
| `ARC_RPC_URL` | `https://rpc.testnet.arc.network` |
| `COOPERATIVE_REGISTRY_ADDRESS` | `0x0e80fc894d8834c2e9001a85921c42bfe6c541a1` |
| `TREASURY_VAULT_ADDRESS` | `0xe287D1acD501ec2A954BA030B7387de12D248E02` |
| `LOAN_POOL_ADDRESS` | `0x52cb1d7fabf31a915eed64e9553a67ff0eefe077` |
| `ROTATION_MANAGER_ADDRESS` | `0xe1b3eacf68b9984a482a69423c6b2a957a80788c` |
| `TREASURY_VAULT_FACTORY_ADDRESS` | (after factory deploy) |
| `LOAN_POOL_FACTORY_ADDRESS` | (after factory deploy) |
| `VAULT_OPERATOR_PRIVATE_KEY` | Deploy key (testnet only) — per-coop vault/pool provision |

Optional role overrides (default to `CIRCLE_AGENT_WALLET_ADDRESS`):

```text
CIRCLE_AGENT_WALLET_LOAN_ADDRESS=0x5669a51537e53bc2d3d1c7f0e30491d7bd4468a0
CIRCLE_AGENT_WALLET_ROTATION_ADDRESS=0x5669a51537e53bc2d3d1c7f0e30491d7bd4468a0
CIRCLE_AGENT_WALLET_TREASURY_ADDRESS=0x5669a51537e53bc2d3d1c7f0e30491d7bd4468a0
CIRCLE_AGENT_WALLET_NEXA_ADDRESS=0x5669a51537e53bc2d3d1c7f0e30491d7bd4468a0
… (contribution, savings, governance, fraud, notification)
```

## What works on Vercel (soft mode)

| Feature | Vercel serverless |
|---------|-------------------|
| `/api/agents/health` | Yes — shows wallet addresses |
| `/api/agents` catalog | Yes |
| Nexa chat (`/api/agents/nexa/ask`) | Yes (needs LLM key + base URL + `DATABASE_URL`) |
| Agent memory / audit | Yes (Postgres) |
| Circle CLI on-chain execute (approve loan, rotation) | **No** — needs long-running worker with `CIRCLE_BIN` + authenticated CLI session |

## Arc agent wallet (already funded)

| Field | Value |
|-------|--------|
| Address | `0x5669a51537e53bc2d3d1c7f0e30491d7bd4468a0` |
| Chain | ARC-TESTNET |
| Explorer | https://testnet.arcscan.app/address/0x5669a51537e53bc2d3d1c7f0e30491d7bd4468a0 |
| Faucet | ~20 native USDC + ~20 ERC-20 USDC |

## Verify after deploy

```bash
curl -s https://YOUR-APP.vercel.app/api/agents/health | jq .
# enabled: true, llmConfigured: true, llmBaseHost: agentrouter.org
# llmModel: <your model>, agents[].walletConfigured: true
# sharedAgentWallet: 0x5669…
```

## Full autonomous worker (optional)

For loan auto-approve / rotation execute with Circle CLI:

```bash
# Machine with `circle wallet login … --testnet` already done
export AGENTS_ENABLED=true
export CIRCLE_BIN=$(which circle)
export DATABASE_URL=…
export CIRCLE_AGENT_WALLET_ADDRESS=0x5669a51537e53bc2d3d1c7f0e30491d7bd4468a0
# + contract addresses
pnpm --filter @workspace/api-server start
```

Grant loan agent on-chain (organizer of each loan pool):

```bash
cast send $LOAN_POOL "setLendingAgent(address)" 0x5669a51537e53bc2d3d1c7f0e30491d7bd4468a0 \
  --rpc-url https://rpc.testnet.arc.network --private-key $ORGANIZER_PK
```

See also: [AGENT_AND_CIRCLE_WALLET_SETUP.md](./AGENT_AND_CIRCLE_WALLET_SETUP.md)

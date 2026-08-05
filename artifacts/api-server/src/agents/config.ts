import type { AgentName, ContractName } from './types';

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

/** First non-empty env among the given names. */
function firstEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = env(name);
    if (value) return value;
  }
  return undefined;
}

function parseAddress(value: string | undefined): `0x${string}` | undefined {
  if (!value || !/^0x[a-fA-F0-9]{40}$/i.test(value)) return undefined;
  return value as `0x${string}`;
}

function requiredAddress(name: string): `0x${string}` {
  const value = parseAddress(env(name));
  if (!value) {
    throw new Error(`${name} must be a valid contract address when AGENTS_ENABLED=true`);
  }
  return value;
}

/**
 * Normalize OpenAI-compatible base URLs.
 * AgentRouter Anthropic docs use `https://agentrouter.org` (no /v1);
 * chat.completions needs `…/v1`.
 *
 * Rewrite bare agentrouter.org → co.agentrouter.org: Vercel serverless
 * hits Aliyun WAF HTML on the marketing host; the API host returns JSON.
 */
function normalizeLlmBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  try {
    const parsed = new URL(trimmed);
    if (
      parsed.hostname === 'agentrouter.org' ||
      parsed.hostname === 'www.agentrouter.org'
    ) {
      parsed.hostname = 'co.agentrouter.org';
    }
    let path = parsed.pathname.replace(/\/+$/, '') || '';
    if (!/\/v\d+$/i.test(path) && !path.includes('/v1')) {
      path = `${path}/v1`.replace(/\/{2,}/g, '/');
    }
    if (!path.startsWith('/')) path = `/${path}`;
    parsed.pathname = path;
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
  }
}

function llmBaseHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}

/** Host-aware default when no model env is set. */
function defaultLlmModel(baseUrl: string): string {
  const host = llmBaseHost(baseUrl).toLowerCase();
  if (host.includes('agentrouter')) {
    // Documented AgentRouter free-tier / gateway model id
    return 'claude-sonnet-4-5-20250929';
  }
  if (host.includes('openrouter')) {
    return 'openai/gpt-4o-mini';
  }
  return 'grok-4.5';
}

const walletEnvKeys: Record<AgentName, string> = {
  treasury: 'CIRCLE_AGENT_WALLET_TREASURY_ADDRESS',
  contribution: 'CIRCLE_AGENT_WALLET_CONTRIBUTION_ADDRESS',
  rotation: 'CIRCLE_AGENT_WALLET_ROTATION_ADDRESS',
  loan: 'CIRCLE_AGENT_WALLET_LOAN_ADDRESS',
  savings: 'CIRCLE_AGENT_WALLET_SAVINGS_ADDRESS',
  governance: 'CIRCLE_AGENT_WALLET_GOVERNANCE_ADDRESS',
  fraud: 'CIRCLE_AGENT_WALLET_FRAUD_ADDRESS',
  nexa: 'CIRCLE_AGENT_WALLET_NEXA_ADDRESS',
  notification: 'CIRCLE_AGENT_WALLET_NOTIFICATION_ADDRESS',
};

/** True on Vercel / Lambda — no long-lived poller; request-driven agents only. */
function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

/**
 * Resolve LLM credentials from several gateway env conventions:
 * - OpenAI / AgentRouter free credit: OPENAI_* or ANTHROPIC_* (key only) + base URL
 * - Generic: LLM_*
 * - SpaceXAI / xAI: XAI_*
 *
 * Prefer gateway / OpenAI-compatible vars over XAI so free AgentRouter credit works
 * even if a dead XAI_API_KEY is still present in Vercel.
 */
const resolvedLlmApiKey = firstEnv(
  'LLM_API_KEY',
  'OPENAI_API_KEY',
  'AGENTROUTER_API_KEY',
  'ANTHROPIC_API_KEY',
  'XAI_API_KEY',
);

const resolvedLlmBaseUrl = normalizeLlmBaseUrl(
  firstEnv(
    'LLM_BASE_URL',
    'OPENAI_BASE_URL',
    'AGENTROUTER_BASE_URL',
    'ANTHROPIC_BASE_URL',
    'XAI_BASE_URL',
  ) ?? 'https://api.x.ai/v1',
);

function resolveLlmModel(baseUrl: string): string {
  const explicit = firstEnv(
    'LLM_MODEL',
    'OPENAI_AGENT_MODEL',
    'AGENTROUTER_MODEL',
    'ANTHROPIC_MODEL',
    'XAI_AGENT_MODEL',
  );
  const host = llmBaseHost(baseUrl).toLowerCase();
  // Vercel often still has XAI_AGENT_MODEL=grok-4.5; that id does not exist on AgentRouter.
  if (
    host.includes('agentrouter') &&
    (!explicit || /^grok/i.test(explicit) || explicit === 'grok-4.5')
  ) {
    return defaultLlmModel(baseUrl);
  }
  if (
    host.includes('openrouter') &&
    (!explicit || /^grok/i.test(explicit))
  ) {
    return defaultLlmModel(baseUrl);
  }
  return explicit ?? defaultLlmModel(baseUrl);
}

const resolvedLlmModel = resolveLlmModel(resolvedLlmBaseUrl);

export const agentConfig = {
  enabled: env('AGENTS_ENABLED') === 'true',
  /** Serverless hosts (Vercel) run agents in soft/request mode only. */
  serverless: isServerless(),
  rpcUrl: env('ARC_RPC_URL') ?? 'https://rpc.testnet.arc.network',
  pollIntervalMs: Number(env('AGENT_POLL_INTERVAL_MS') ?? 12_000),
  maxRetries: Number(env('AGENT_MAX_RETRIES') ?? 5),
  /**
   * OpenAI-compatible LLM (AgentRouter, OpenRouter, xAI, etc.).
   * Uses chat.completions — not the Responses API — for gateway compatibility.
   */
  llmApiKey: resolvedLlmApiKey,
  llmBaseUrl: resolvedLlmBaseUrl,
  llmModel: resolvedLlmModel,
  /** Safe for health endpoints (no secrets). */
  llmBaseHost: llmBaseHost(resolvedLlmBaseUrl),
  circleBin: env('CIRCLE_BIN'),
  rateLimitWindowMs: Number(env('AGENT_RATE_LIMIT_WINDOW_MS') ?? 60_000),
  rateLimitMaxWalletCalls: Number(env('AGENT_RATE_LIMIT_MAX_WALLET_CALLS') ?? 10),
  contracts: {
    registry: env('COOPERATIVE_REGISTRY_ADDRESS'),
    treasury: env('TREASURY_VAULT_ADDRESS'),
    loanPool: env('LOAN_POOL_ADDRESS'),
    rotationManager: env('ROTATION_MANAGER_ADDRESS'),
  } as Record<ContractName, string | undefined>,

  /**
   * Per-agent wallet, falling back to CIRCLE_AGENT_WALLET_ADDRESS
   * (one Circle Agent Stack wallet can serve all roles on Arc Testnet MVP).
   */
  walletAddress(agent: AgentName): `0x${string}` | undefined {
    return (
      parseAddress(env(walletEnvKeys[agent])) ??
      parseAddress(env('CIRCLE_AGENT_WALLET_ADDRESS'))
    );
  },

  contractAddress(name: ContractName): `0x${string}` | undefined {
    return parseAddress(this.contracts[name]);
  },

  /** Whether Circle CLI can submit mutating txs from this host. */
  canExecuteOnChain(): boolean {
    return Boolean(this.circleBin);
  },

  /**
   * Full worker (local/VPS): contracts + DB + CIRCLE_BIN required.
   * Soft/serverless (Vercel): DB required for memory/audit; CIRCLE_BIN optional
   * (Nexa / recommendations still work; on-chain execute needs a worker).
   */
  assertRunnable(mode: 'full' | 'soft' = 'full'): void {
    if (!this.enabled) return;
    if (!env('DATABASE_URL')) {
      throw new Error(
        'DATABASE_URL is required when AGENTS_ENABLED=true (agent memory, tasks, audit)',
      );
    }
    if (mode === 'soft' || this.serverless) {
      // Soft mode: wallet addresses optional but recommended; no CIRCLE_BIN hard-fail
      return;
    }
    requiredAddress('COOPERATIVE_REGISTRY_ADDRESS');
    requiredAddress('TREASURY_VAULT_ADDRESS');
    requiredAddress('LOAN_POOL_ADDRESS');
    requiredAddress('ROTATION_MANAGER_ADDRESS');
    if (!this.circleBin) {
      throw new Error(
        'CIRCLE_BIN must point to the authenticated Circle CLI for full agent worker mode (never store seed phrases in Nexusu)',
      );
    }
  },
};

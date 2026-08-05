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

function llmBaseHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}

/** True for OpenRouter keys (sk-or-v1-…). */
function isOpenRouterKey(key: string | undefined): boolean {
  if (!key) return false;
  const k = key.replace(/^Bearer\s+/i, '').trim();
  return /^sk-or-/i.test(k) || /^or-v1-/i.test(k);
}

function stripKey(key: string): string {
  return key.replace(/^Bearer\s+/i, '').trim();
}

/**
 * Normalize OpenAI-compatible base URLs.
 * - OpenRouter: https://openrouter.ai/api/v1
 * - AgentRouter: bare agentrouter.org → co.agentrouter.org/v1 (WAF bypass)
 * - Others: ensure …/v1
 */
function normalizeLlmBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    // OpenRouter official path is /api/v1 (not /v1 alone)
    if (host === 'openrouter.ai' || host === 'www.openrouter.ai') {
      parsed.hostname = 'openrouter.ai';
      parsed.pathname = '/api/v1';
      return `${parsed.origin}${parsed.pathname}`;
    }

    // AgentRouter marketing host → API host (Vercel hits WAF on bare host)
    if (host === 'agentrouter.org' || host === 'www.agentrouter.org') {
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

/** Host-aware default when no model env is set. */
function defaultLlmModel(baseUrl: string): string {
  const host = llmBaseHost(baseUrl).toLowerCase();
  if (host.includes('openrouter')) {
    // OpenRouter model ids are provider/model
    return 'openai/gpt-4o-mini';
  }
  if (host.includes('agentrouter')) {
    return 'claude-sonnet-4-5-20250929';
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

const LLM_KEY_ENVS = [
  'OPENROUTER_API_KEY',
  'OPENROUTER_KEY',
  'OPEN_ROUTER_API_KEY',
  'LLM_API_KEY',
  'OPENAI_API_KEY',
  'AGENTROUTER_API_KEY',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'XAI_API_KEY',
] as const;

const LLM_BASE_ENVS = [
  'OPENROUTER_BASE_URL',
  'OPEN_ROUTER_BASE_URL',
  'LLM_BASE_URL',
  'OPENAI_BASE_URL',
  'AGENTROUTER_BASE_URL',
  'ANTHROPIC_BASE_URL',
  'XAI_BASE_URL',
] as const;

/**
 * Prefer an OpenRouter key (sk-or-…) from any env slot over other keys.
 * Stops a leftover AgentRouter/xAI key from winning when OpenRouter is also set.
 */
function resolveLlmApiKey(): string | undefined {
  const pairs = LLM_KEY_ENVS.map((name) => {
    const raw = env(name);
    return raw ? { name, value: stripKey(raw) } : null;
  }).filter(Boolean) as Array<{ name: string; value: string }>;

  const openRouter = pairs.find((p) => isOpenRouterKey(p.value));
  if (openRouter) return openRouter.value;
  return pairs[0]?.value;
}

function wantsOpenRouter(apiKey: string | undefined): boolean {
  if (isOpenRouterKey(apiKey)) return true;
  const provider = (env('LLM_PROVIDER') ?? env('AI_PROVIDER') ?? '').toLowerCase();
  if (provider === 'openrouter' || provider === 'open-router') return true;
  for (const name of LLM_BASE_ENVS) {
    const v = env(name);
    if (v && /openrouter/i.test(v)) return true;
  }
  // Explicit OpenRouter key env set (even if value was empty we already skipped)
  if (env('OPENROUTER_API_KEY') || env('OPENROUTER_KEY') || env('OPEN_ROUTER_API_KEY')) {
    return true;
  }
  return false;
}

function resolveLlmBaseUrl(apiKey: string | undefined): string {
  const explicit = firstEnv(...LLM_BASE_ENVS);

  // OpenRouter always uses openrouter.ai — ignore leftover agentrouter URLs in Vercel.
  if (wantsOpenRouter(apiKey)) {
    if (explicit && /openrouter/i.test(explicit)) {
      return normalizeLlmBaseUrl(explicit);
    }
    return 'https://openrouter.ai/api/v1';
  }

  if (explicit) return normalizeLlmBaseUrl(explicit);
  return 'https://api.x.ai/v1';
}

const resolvedLlmApiKey = resolveLlmApiKey();
const resolvedLlmBaseUrl = resolveLlmBaseUrl(resolvedLlmApiKey);

function llmKeyKind(key: string | undefined): string {
  if (!key) return 'none';
  if (isOpenRouterKey(key)) return 'openrouter';
  if (/^xai-/i.test(key)) return 'xai';
  if (/^sk-ant-/i.test(key)) return 'anthropic';
  if (/^sk-/i.test(key)) return 'openai-style';
  return 'other';
}

function resolveLlmModel(baseUrl: string, apiKey: string | undefined): string {
  const explicit = firstEnv(
    'OPENROUTER_MODEL',
    'LLM_MODEL',
    'OPENAI_AGENT_MODEL',
    'AGENTROUTER_MODEL',
    'ANTHROPIC_MODEL',
    'XAI_AGENT_MODEL',
  );
  const host = llmBaseHost(baseUrl).toLowerCase();
  const onOpenRouter =
    host.includes('openrouter') || isOpenRouterKey(apiKey);
  const onAgentRouter = host.includes('agentrouter');

  // Drop xAI-only model names on third-party gateways
  if (onOpenRouter && (!explicit || /^grok/i.test(explicit))) {
    return defaultLlmModel(baseUrl.includes('openrouter') ? baseUrl : 'https://openrouter.ai/api/v1');
  }
  // OpenRouter model ids are "provider/model" — bare Claude/GPT names often 404
  if (
    onOpenRouter &&
    explicit &&
    !explicit.includes('/') &&
    !/^openai\//i.test(explicit)
  ) {
    // Common bare names → OpenRouter ids
    const map: Record<string, string> = {
      'gpt-4o-mini': 'openai/gpt-4o-mini',
      'gpt-4o': 'openai/gpt-4o',
      'gpt-4.1': 'openai/gpt-4.1',
      'gpt-4.1-mini': 'openai/gpt-4.1-mini',
      'claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet',
      'claude-sonnet-4': 'anthropic/claude-sonnet-4',
    };
    if (map[explicit]) return map[explicit];
  }
  if (onAgentRouter && (!explicit || /^grok/i.test(explicit))) {
    return defaultLlmModel(baseUrl);
  }
  return explicit ?? defaultLlmModel(baseUrl);
}

const resolvedLlmModel = resolveLlmModel(resolvedLlmBaseUrl, resolvedLlmApiKey);

export const agentConfig = {
  enabled: env('AGENTS_ENABLED') === 'true',
  /** Serverless hosts (Vercel) run agents in soft/request mode only. */
  serverless: isServerless(),
  rpcUrl: env('ARC_RPC_URL') ?? 'https://rpc.testnet.arc.network',
  pollIntervalMs: Number(env('AGENT_POLL_INTERVAL_MS') ?? 12_000),
  maxRetries: Number(env('AGENT_MAX_RETRIES') ?? 5),
  /**
   * OpenAI-compatible LLM (OpenRouter, AgentRouter, xAI, etc.).
   * Uses chat.completions — not the Responses API — for gateway compatibility.
   */
  llmApiKey: resolvedLlmApiKey,
  llmBaseUrl: resolvedLlmBaseUrl,
  llmModel: resolvedLlmModel,
  /** Safe for health endpoints (no secrets). */
  llmBaseHost: llmBaseHost(resolvedLlmBaseUrl),
  /** Safe key family label for debugging Vercel env wiring. */
  llmKeyKind: llmKeyKind(resolvedLlmApiKey),
  llmProvider: llmBaseHost(resolvedLlmBaseUrl).includes('openrouter')
    ? 'openrouter'
    : llmBaseHost(resolvedLlmBaseUrl).includes('agentrouter')
      ? 'agentrouter'
      : llmBaseHost(resolvedLlmBaseUrl).includes('x.ai')
        ? 'xai'
        : 'openai-compatible',
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

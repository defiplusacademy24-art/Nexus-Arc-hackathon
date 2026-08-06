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

    // Keep agentrouter.org as-is (same host Claude Code uses).
    // Path must end with /v1 for OpenAI-compatible chat.completions.
    if (host === 'www.agentrouter.org') {
      parsed.hostname = 'agentrouter.org';
    }

    let path = parsed.pathname.replace(/\/+$/, '') || '';
    // ANTHROPIC_BASE_URL is often https://agentrouter.org/ (no /v1) — Claude Code style
    if (
      (host === 'agentrouter.org' || host === 'co.agentrouter.org') &&
      (!path || path === '/')
    ) {
      path = '/v1';
    } else if (!/\/v\d+$/i.test(path) && !path.includes('/v1')) {
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
  // AgentRouter first for Claude Code–style keys (sk-… not sk-or-)
  'AGENTROUTER_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_API_KEY',
  'OPENROUTER_API_KEY',
  'OPENROUTER_KEY',
  'OPEN_ROUTER_API_KEY',
  'LLM_API_KEY',
  'OPENAI_API_KEY',
  'XAI_API_KEY',
] as const;

const LLM_BASE_ENVS = [
  'AGENTROUTER_BASE_URL',
  'ANTHROPIC_BASE_URL',
  'OPENROUTER_BASE_URL',
  'OPEN_ROUTER_BASE_URL',
  'LLM_BASE_URL',
  'OPENAI_BASE_URL',
  'XAI_BASE_URL',
] as const;

/**
 * Prefer a real OpenRouter key (sk-or-…) when present.
 * Otherwise use the first configured key (AgentRouter / Anthropic / OpenAI / …).
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

function providerHint(): string {
  return (env('LLM_PROVIDER') ?? env('AI_PROVIDER') ?? '').toLowerCase().trim();
}

function anyBaseMatches(re: RegExp): boolean {
  for (const name of LLM_BASE_ENVS) {
    const v = env(name);
    if (v && re.test(v)) return true;
  }
  return false;
}

/**
 * OpenRouter only when we have a real sk-or- key, or the user explicitly
 * points base URL / provider at openrouter AND the key is sk-or- (or empty).
 * Putting a Claude Code / AgentRouter key into OPENROUTER_API_KEY must NOT
 * force openrouter.ai (that caused 401 Missing Authentication).
 */
function wantsOpenRouter(apiKey: string | undefined): boolean {
  if (isOpenRouterKey(apiKey)) return true;
  const provider = providerHint();
  if (provider === 'agentrouter' || provider === 'agent-router') return false;
  if (anyBaseMatches(/agentrouter/i)) return false;
  // Non–sk-or key can never authenticate to OpenRouter
  if (apiKey && !isOpenRouterKey(apiKey)) return false;
  if (provider === 'openrouter' || provider === 'open-router') return true;
  if (anyBaseMatches(/openrouter/i)) return true;
  return false;
}

function wantsAgentRouter(apiKey: string | undefined): boolean {
  if (isOpenRouterKey(apiKey)) return false;
  const provider = providerHint();
  if (provider === 'agentrouter' || provider === 'agent-router') return true;
  if (anyBaseMatches(/agentrouter/i)) return true;
  if (env('AGENTROUTER_API_KEY') || env('AGENTROUTER_BASE_URL')) return true;
  // Claude Code style: ANTHROPIC_BASE_URL=https://agentrouter.org/
  if (env('ANTHROPIC_BASE_URL') && /agentrouter/i.test(env('ANTHROPIC_BASE_URL')!)) {
    return true;
  }
  // Non–sk-or sk- key + no other explicit provider → treat as AgentRouter
  // (AgentRouter keys look like sk-VuHa…; OpenRouter is sk-or-v1-…)
  if (
    apiKey &&
    /^sk-/i.test(apiKey) &&
    !isOpenRouterKey(apiKey) &&
    !/^sk-ant-/i.test(apiKey) &&
    !/^sk-proj-/i.test(apiKey) &&
    provider !== 'openai' &&
    provider !== 'xai' &&
    provider !== 'openrouter'
  ) {
    // Only auto-pick AgentRouter when provider/base hints exist, or
    // OPENROUTER_* was misused for an AgentRouter key.
    if (
      provider === 'agentrouter' ||
      anyBaseMatches(/agentrouter/i) ||
      env('AGENTROUTER_API_KEY') ||
      // Misnamed env: key in OPENROUTER_API_KEY but not sk-or-
      (env('OPENROUTER_API_KEY') && !isOpenRouterKey(env('OPENROUTER_API_KEY')))
    ) {
      return true;
    }
  }
  return false;
}

function resolveLlmBaseUrl(apiKey: string | undefined): string {
  const explicit = firstEnv(...LLM_BASE_ENVS);

  // Real OpenRouter keys always hit openrouter.ai
  if (wantsOpenRouter(apiKey)) {
    if (explicit && /openrouter/i.test(explicit)) {
      return normalizeLlmBaseUrl(explicit);
    }
    return 'https://openrouter.ai/api/v1';
  }

  // AgentRouter (Claude Code): same host as https://agentrouter.org/
  if (wantsAgentRouter(apiKey)) {
    if (explicit && /agentrouter/i.test(explicit)) {
      return normalizeLlmBaseUrl(explicit);
    }
    return 'https://agentrouter.org/v1';
  }

  if (explicit) return normalizeLlmBaseUrl(explicit);
  return 'https://api.x.ai/v1';
}

function llmKeyKind(key: string | undefined): string {
  if (!key) return 'none';
  if (isOpenRouterKey(key)) return 'openrouter';
  if (/^xai-/i.test(key)) return 'xai';
  if (/^sk-ant-/i.test(key)) return 'anthropic';
  if (/^sk-/i.test(key)) return 'openai-style';
  return 'other';
}

/** Safe prefix for health (never the full secret). */
function llmKeyPrefix(key: string | undefined): string | null {
  if (!key) return null;
  // show first 7 chars of key shape only, e.g. "sk-or-v" or "sk-proj"
  return key.slice(0, 7);
}

function resolveLlmModel(baseUrl: string, apiKey: string | undefined): string {
  const explicit = firstEnv(
    'AGENTROUTER_MODEL',
    'ANTHROPIC_MODEL',
    'OPENROUTER_MODEL',
    'LLM_MODEL',
    'OPENAI_AGENT_MODEL',
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
      'claude-opus-5': 'anthropic/claude-opus-5',
      'claude-opus-5-fast': 'anthropic/claude-opus-5-fast',
    };
    if (map[explicit]) return map[explicit];
  }
  // AgentRouter uses bare model ids (Claude Code style), not provider/model
  if (onAgentRouter) {
    if (!explicit || /^grok/i.test(explicit)) {
      return defaultLlmModel(baseUrl);
    }
    // Map OpenRouter-style ids users often paste by mistake
    const arMap: Record<string, string> = {
      // Keep bare AgentRouter ids users see in their console / Claude Code
      'anthropic/claude-opus-5': 'claude-opus-5',
      'anthropic/claude-opus-5-fast': 'claude-opus-5-fast',
      'anthropic/claude-sonnet-4': 'claude-sonnet-4-5-20250929',
      'anthropic/claude-3.5-sonnet': 'claude-sonnet-4-5-20250929',
      'openai/gpt-4o-mini': 'gpt-4o-mini',
      'openai/gpt-4o': 'gpt-4o',
      // already bare — pass through via explicit return below
    };
    if (arMap[explicit]) return arMap[explicit];
    // Strip provider/ prefix if present
    if (explicit.includes('/')) {
      return explicit.split('/').pop() || explicit;
    }
    return explicit;
  }
  return explicit ?? defaultLlmModel(baseUrl);
}

/**
 * Lazy LLM resolution so serverless always reads live process.env
 * (never a build-time snapshot).
 */
function liveLlm() {
  const apiKey = resolveLlmApiKey();
  const baseUrl = resolveLlmBaseUrl(apiKey);
  const model = resolveLlmModel(baseUrl, apiKey);
  const host = llmBaseHost(baseUrl);
  const keyKind = llmKeyKind(apiKey);
  const provider = host.includes('openrouter')
    ? 'openrouter'
    : host.includes('agentrouter')
      ? 'agentrouter'
      : host.includes('x.ai')
        ? 'xai'
        : 'openai-compatible';

  let authHint: string | undefined;
  if (!apiKey) {
    authHint =
      'No LLM key found. For AgentRouter (Claude Code): set AGENTROUTER_API_KEY + AGENTROUTER_BASE_URL=https://agentrouter.org/v1. For OpenRouter: OPENROUTER_API_KEY=sk-or-v1-…';
  } else if (provider === 'openrouter' && !isOpenRouterKey(apiKey)) {
    authHint =
      'Host is openrouter.ai but key does not start with sk-or-. ' +
      'If this is an AgentRouter key (from agentrouter.org), set LLM_PROVIDER=agentrouter and BASE_URL=https://agentrouter.org/v1 — do not use openrouter.ai.';
  } else if (provider === 'agentrouter') {
    authHint =
      'Using AgentRouter (agentrouter.org). Prefer model ids like claude-sonnet-4-5-20250929 or gpt-4o-mini (not anthropic/…). ' +
      'If Vercel still gets 401, regenerate the token at agentrouter.org/console/token.';
  }

  return { apiKey, baseUrl, model, host, keyKind, provider, authHint };
}

export const agentConfig = {
  get enabled(): boolean {
    return env('AGENTS_ENABLED') === 'true';
  },
  /** Serverless hosts (Vercel) run agents in soft/request mode only. */
  get serverless(): boolean {
    return isServerless();
  },
  get rpcUrl(): string {
    return env('ARC_RPC_URL') ?? 'https://rpc.testnet.arc.network';
  },
  get pollIntervalMs(): number {
    return Number(env('AGENT_POLL_INTERVAL_MS') ?? 12_000);
  },
  get maxRetries(): number {
    return Number(env('AGENT_MAX_RETRIES') ?? 5);
  },
  /**
   * OpenAI-compatible LLM (OpenRouter, AgentRouter, xAI, etc.).
   * Uses chat.completions — not the Responses API — for gateway compatibility.
   */
  get llmApiKey(): string | undefined {
    return liveLlm().apiKey;
  },
  get llmBaseUrl(): string {
    return liveLlm().baseUrl;
  },
  get llmModel(): string {
    return liveLlm().model;
  },
  /** Safe for health endpoints (no secrets). */
  get llmBaseHost(): string {
    return liveLlm().host;
  },
  /** Safe key family label for debugging Vercel env wiring. */
  get llmKeyKind(): string {
    return liveLlm().keyKind;
  },
  get llmProvider(): string {
    return liveLlm().provider;
  },
  /** Key length only — helps confirm Vercel injected the secret. */
  get llmKeyLength(): number {
    return liveLlm().apiKey?.length ?? 0;
  },
  get llmKeyPrefix(): string | null {
    return llmKeyPrefix(liveLlm().apiKey);
  },
  /** Human-readable misconfiguration hint (safe). */
  get llmAuthHint(): string | undefined {
    return liveLlm().authHint;
  },
  get circleBin(): string | undefined {
    return env('CIRCLE_BIN');
  },
  get rateLimitWindowMs(): number {
    return Number(env('AGENT_RATE_LIMIT_WINDOW_MS') ?? 60_000);
  },
  get rateLimitMaxWalletCalls(): number {
    return Number(env('AGENT_RATE_LIMIT_MAX_WALLET_CALLS') ?? 10);
  },
  get contracts(): Record<ContractName, string | undefined> {
    return {
      registry: env('COOPERATIVE_REGISTRY_ADDRESS'),
      treasury: env('TREASURY_VAULT_ADDRESS'),
      loanPool: env('LOAN_POOL_ADDRESS'),
      rotationManager: env('ROTATION_MANAGER_ADDRESS'),
    };
  },

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

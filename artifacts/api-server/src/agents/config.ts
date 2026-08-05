import type { AgentName, ContractName } from './types';

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
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

export const agentConfig = {
  enabled: env('AGENTS_ENABLED') === 'true',
  /** Serverless hosts (Vercel) run agents in soft/request mode only. */
  serverless: isServerless(),
  rpcUrl: env('ARC_RPC_URL') ?? 'https://rpc.testnet.arc.network',
  pollIntervalMs: Number(env('AGENT_POLL_INTERVAL_MS') ?? 12_000),
  maxRetries: Number(env('AGENT_MAX_RETRIES') ?? 5),
  /** Prefer SpaceXAI (xAI). OPENAI_* kept as fallback for existing deploys. */
  llmApiKey: env('XAI_API_KEY') ?? env('OPENAI_API_KEY'),
  llmBaseUrl: env('XAI_BASE_URL') ?? env('OPENAI_BASE_URL') ?? 'https://api.x.ai/v1',
  llmModel: env('XAI_AGENT_MODEL') ?? env('OPENAI_AGENT_MODEL') ?? 'grok-4.5',
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

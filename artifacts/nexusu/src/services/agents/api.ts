/**
 * Autonomous multi-agent runtime API client.
 * Backed by artifacts/api-server/src/routes/agents.ts
 */

export type AgentToolKind = 'read' | 'write' | 'compute' | 'notify';

export type AgentCatalogItem = {
  name: string;
  promptSummary: string;
  tools: Array<{ name: string; kind: AgentToolKind; description: string }>;
  walletConfigured: boolean;
  walletAddress: string | null;
};

export type AgentHealthItem = {
  agent: string;
  ready: boolean;
  queueDepth: number;
  lastEventAt?: string;
  lastDecisionAt?: string;
  lastError?: string;
  walletConfigured: boolean;
  walletAddress?: string;
};

export type AgentsHealthResponse = {
  enabled: boolean;
  llmConfigured: boolean;
  llmModel: string;
  contracts: Record<string, string | undefined>;
  agents: AgentHealthItem[];
};

export type AgentsCatalogResponse = {
  architecture: string;
  custody: string;
  walletProvider: string;
  agents: AgentCatalogItem[];
};

export type AgentAuditRow = {
  id: string;
  agent: string;
  action: string;
  status: string;
  idempotencyKey?: string;
  txHash?: string;
  detail: unknown;
  createdAt: string;
};

const AGENT_LABELS: Record<string, string> = {
  treasury: 'Treasury Agent',
  contribution: 'Contribution Agent',
  rotation: 'Rotation Agent',
  loan: 'Loan Agent',
  savings: 'Savings Agent',
  governance: 'Governance Agent',
  fraud: 'Fraud Detection Agent',
  nexa: 'Nexa AI Assistant',
  notification: 'Notification Agent',
};

const AGENT_BLURBS: Record<string, string> = {
  treasury: 'Monitors vault deposits, balances, and allocations. Recommendations only.',
  contribution: 'Tracks dues, missed payments, and contribution cycle completion.',
  rotation: 'Executes rotation payouts when a cycle is complete (Circle wallet).',
  loan: 'Evaluates applications; can approve/reject via lending agent wallet.',
  savings: 'Savings and allocation recommendations — never invests automatically.',
  governance: 'Proposals, votes, and loan override reviews.',
  fraud: 'Anomaly and risk alerts (low → critical).',
  nexa: 'Member-scoped financial assistant.',
  notification: 'Dashboard notifications for cooperative events.',
};

export function agentDisplayName(name: string): string {
  return AGENT_LABELS[name] ?? name.replace(/^\w/, (c) => c.toUpperCase());
}

export function agentBlurb(name: string): string {
  return AGENT_BLURBS[name] ?? 'Autonomous cooperative agent.';
}

export function shortAddress(addr?: string | null): string {
  if (!addr || addr.length < 10) return addr ?? '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? res.statusText;
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}

export async function fetchAgentsCatalog(): Promise<AgentsCatalogResponse> {
  const res = await fetch('/api/agents');
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<AgentsCatalogResponse>;
}

export async function fetchAgentsHealth(): Promise<AgentsHealthResponse> {
  const res = await fetch('/api/agents/health');
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<AgentsHealthResponse>;
}

export async function fetchAgentsAudit(opts?: {
  agent?: string;
  limit?: number;
}): Promise<{ audit: AgentAuditRow[] }> {
  const params = new URLSearchParams();
  if (opts?.agent) params.set('agent', opts.agent);
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  const res = await fetch(`/api/agents/audit${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ audit: AgentAuditRow[] }>;
}

/** Merged view for the dashboard. */
export type AgentDashboardRow = {
  name: string;
  displayName: string;
  blurb: string;
  promptSummary: string;
  tools: AgentCatalogItem['tools'];
  walletConfigured: boolean;
  walletAddress: string | null;
  ready: boolean;
  queueDepth: number;
  lastEventAt?: string;
  lastDecisionAt?: string;
  lastError?: string;
};

export async function fetchAgentsDashboard(): Promise<{
  enabled: boolean;
  llmConfigured: boolean;
  llmModel: string;
  contracts: Record<string, string | undefined>;
  agents: AgentDashboardRow[];
  error?: string;
}> {
  try {
    const [catalog, health] = await Promise.all([
      fetchAgentsCatalog(),
      fetchAgentsHealth(),
    ]);
    const healthByName = new Map(health.agents.map((a) => [a.agent, a]));

    const agents: AgentDashboardRow[] = catalog.agents.map((c) => {
      const h = healthByName.get(c.name);
      return {
        name: c.name,
        displayName: agentDisplayName(c.name),
        blurb: agentBlurb(c.name),
        promptSummary: c.promptSummary,
        tools: c.tools,
        walletConfigured: h?.walletConfigured ?? c.walletConfigured,
        walletAddress: h?.walletAddress ?? c.walletAddress,
        ready: h?.ready ?? false,
        queueDepth: h?.queueDepth ?? 0,
        lastEventAt: h?.lastEventAt,
        lastDecisionAt: h?.lastDecisionAt,
        lastError: h?.lastError,
      };
    });

    return {
      enabled: health.enabled,
      llmConfigured: health.llmConfigured,
      llmModel: health.llmModel,
      contracts: health.contracts ?? {},
      agents,
    };
  } catch (e) {
    // API offline / not deployed — still list expected agents as offline
    const names = Object.keys(AGENT_LABELS);
    return {
      enabled: false,
      llmConfigured: false,
      llmModel: '—',
      contracts: {},
      agents: names.map((name) => ({
        name,
        displayName: agentDisplayName(name),
        blurb: agentBlurb(name),
        promptSummary: '',
        tools: [],
        walletConfigured: false,
        walletAddress: null,
        ready: false,
        queueDepth: 0,
      })),
      error: e instanceof Error ? e.message : 'Failed to load agents',
    };
  }
}

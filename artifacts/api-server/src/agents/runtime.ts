import { randomUUID } from 'node:crypto';
import { createPublicClient, http, type Address } from 'viem';
import { arcTestnet } from 'viem/chains';
import { logger } from '../lib/logger';
import { createNotification, type NotifType } from '../lib/store';
import { publishNotification } from '../lib/events';
import { agentConfig } from './config';
import { DecisionEngine } from './decision-engine';
import { AgentEventBus } from './event-bus';
import { AgentStore } from './store';
import { CircleAgentWallets } from './wallets';
import { SlidingWindowRateLimiter } from './rate-limit';
import { createAgentServices } from './services';
import type { BaseAgent } from './base-agent';
import type {
  AgentDecision,
  AgentHealth,
  AgentName,
  AgentServiceContext,
  DomainEvent,
  WalletCallRequest,
} from './types';
import { AGENT_NAMES } from './types';

/**
 * Multi-agent orchestrator.
 * Each agent remains an independent service; this class only owns shared
 * infrastructure: event bus, durable queue, wallets, rate limits, health.
 */
export class AgentRuntime {
  readonly bus = new AgentEventBus();
  readonly store = new AgentStore();
  readonly wallets = new CircleAgentWallets();
  readonly decision = new DecisionEngine();
  readonly agents: BaseAgent[];

  private readonly health = new Map<AgentName, AgentHealth>();
  private readonly unsubscribers: Array<() => void> = [];
  private readonly rateLimiter: SlidingWindowRateLimiter;
  private timer?: NodeJS.Timeout;
  private started = false;

  constructor() {
    this.agents = createAgentServices(this.decision);
    this.rateLimiter = new SlidingWindowRateLimiter(
      agentConfig.rateLimitWindowMs,
      agentConfig.rateLimitMaxWalletCalls,
    );
  }

  /**
   * @param opts.soft — request-driven mode (Vercel): init store + health, no poller.
   *                    On-chain execute still needs CIRCLE_BIN on a long-running worker.
   */
  async start(opts?: { soft?: boolean }): Promise<void> {
    if (this.started) return;
    const soft = Boolean(opts?.soft || agentConfig.serverless);
    agentConfig.assertRunnable(soft ? 'soft' : 'full');
    await this.store.initialize();

    for (const agent of this.agents) {
      const wallet = this.wallets.wallet(agent.name);
      this.health.set(agent.name, {
        agent: agent.name,
        ready: true,
        queueDepth: 0,
        walletConfigured: Boolean(wallet),
        walletAddress: wallet?.address,
      });

      const unsub = this.bus.subscribe(
        agent.name,
        agent.subscriptions,
        (event) => {
          void this.store
            .enqueue(agent.name, event, agentConfig.maxRetries)
            .catch((err) =>
              logger.error(
                { err, agent: agent.name, event: event.name },
                'Failed to enqueue agent task',
              ),
            );
        },
      );
      this.unsubscribers.push(unsub);
    }

    this.started = true;

    if (!soft) {
      this.timer = setInterval(
        () => void this.drain(),
        Math.max(1_000, agentConfig.pollIntervalMs),
      );
      await this.drain();
    }

    logger.info(
      {
        soft,
        serverless: agentConfig.serverless,
        canExecuteOnChain: agentConfig.canExecuteOnChain(),
        agents: this.agents.map((a) => a.name),
        wallets: AGENT_NAMES.map((n) => ({
          agent: n,
          configured: Boolean(this.wallets.wallet(n)),
          address: this.wallets.wallet(n)?.address,
        })),
      },
      soft
        ? 'Agent runtime started (soft / request-driven)'
        : 'Autonomous multi-agent runtime started',
    );
  }

  /** Idempotent start for HTTP handlers (Nexa, health, emit) on Vercel. */
  async ensureStarted(): Promise<void> {
    if (this.started) return;
    await this.start({ soft: agentConfig.serverless });
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers.length = 0;
    this.started = false;
  }

  async statuses(): Promise<AgentHealth[]> {
    if (agentConfig.enabled && !this.started) {
      try {
        await this.ensureStarted();
      } catch (err) {
        logger.warn({ err }, 'Agent soft-start failed during health check');
      }
    }
    const out: AgentHealth[] = [];
    for (const agent of AGENT_NAMES) {
      const base = this.health.get(agent) ?? {
        agent,
        ready: this.started,
        queueDepth: 0,
        walletConfigured: Boolean(this.wallets.wallet(agent)),
        walletAddress: this.wallets.wallet(agent)?.address,
      };
      try {
        base.queueDepth = await this.store.queueDepth(agent);
      } catch {
        // store may be unavailable when agents disabled
      }
      out.push({ ...base });
    }
    return out;
  }

  /** Ingest a domain event (chain, API, or inter-agent). Deduped by idempotency key. */
  async emit(
    event: Omit<DomainEvent, 'id' | 'occurredAt'>,
  ): Promise<DomainEvent | null> {
    const complete: DomainEvent = {
      ...event,
      id: randomUUID(),
      occurredAt: new Date().toISOString(),
      blockNumber:
        event.blockNumber != null ? event.blockNumber : undefined,
    };
    const isNew = await this.store.recordEvent(complete);
    if (!isNew) return null;
    this.bus.publish(complete);
    return complete;
  }

  /**
   * Process up to `maxTasks` queued items across all agents.
   * Used by the background poller and by Vercel soft-mode HTTP tick/emit.
   */
  async tick(maxTasks = 24): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;
    // Round-robin agents so one busy agent does not starve others
    for (let i = 0; i < maxTasks; i++) {
      let claimed = false;
      for (const service of this.agents) {
        const before = processed;
        const ok = await this.drainAgent(service);
        if (ok === 'processed') {
          processed += 1;
          claimed = true;
          break;
        }
        if (ok === 'error') {
          errors += 1;
          processed += 1;
          claimed = true;
          break;
        }
        void before;
      }
      if (!claimed) break;
    }
    return { processed, errors };
  }

  private contextFor(agent: AgentName): AgentServiceContext {
    return {
      remember: (key, value) => this.store.remember(agent, key, value),
      recall: (key) => this.store.recall(agent, key),
      audit: (action, status, detail, idempotencyKey, txHash) =>
        this.store.audit(agent, action, status, detail, idempotencyKey, txHash),
      wallet: this.wallets.wallet(agent),
    };
  }

  private async drain(): Promise<void> {
    await this.tick(AGENT_NAMES.length * 2);
  }

  /** @returns whether a task was claimed (processed or error) */
  private async drainAgent(
    service: BaseAgent,
  ): Promise<'empty' | 'processed' | 'error'> {
    const agent = service.name;
    const task = await this.store.claim(agent);
    if (!task) return 'empty';

    const health = this.health.get(agent);
    if (health) health.lastEventAt = new Date().toISOString();

    try {
      const ctx = this.contextFor(agent);
      const result = await service.handle(task.event, ctx);

      if (health) health.lastDecisionAt = new Date().toISOString();

      // Persist memory updates
      for (const m of result.memoryUpdates ?? []) {
        await this.store.remember(agent, m.key, m.value);
      }

      // Wallet execution — only mutating calls, rate-limited, allowlisted
      if (result.walletCall) {
        await this.executeWalletCall(agent, result.walletCall, result.decision);
      } else {
        await this.store.audit(
          agent,
          'decision',
          result.decision.decision === 'approved' ||
            result.decision.decision === 'rejected'
            ? 'blocked'
            : 'success',
          result.decision,
          task.event.idempotencyKey,
        );
      }

      // Inter-agent follow-up events
      for (const follow of result.followUpEvents ?? []) {
        await this.emit(follow);
      }

      // Notifications produced by the agent
      for (const n of result.notifications ?? []) {
        if (n.recipientWallet) {
          try {
            const created = await createNotification({
              recipientWallet: n.recipientWallet,
              coopId: n.coopId,
              type: mapNotifType(n.type),
              title: n.title,
              description: n.description,
              metadata: n.metadata,
            });
            publishNotification(created);
          } catch (err) {
            logger.warn({ err, agent }, 'Agent notification failed');
          }
        } else {
          // Fan out to notification agent via bus
          await this.emit({
            name: 'notification.requested',
            source: agent,
            idempotencyKey: `notify:${agent}:${task.event.idempotencyKey}:${n.title}`,
            payload: n,
          });
        }
      }

      await this.store.complete(task.id);
      if (health) health.lastError = undefined;
      return 'processed';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (health) health.lastError = message;
      await this.store.retry(task, error);
      await this.store.audit(
        agent,
        'task',
        'error',
        { error: message, event: task.event.name },
        task.event.idempotencyKey,
      );
      logger.error({ agent, err: error, taskId: task.id }, 'Agent task failed');
      return 'error';
    }
  }

  private async executeWalletCall(
    agent: AgentName,
    call: WalletCallRequest,
    decision: AgentDecision,
  ): Promise<void> {
    if (decision.decision !== 'approved' || decision.requiresHumanApproval) {
      await this.store.audit(
        agent,
        call.functionName,
        'blocked',
        { reason: 'decision not approved or needs human', decision, call },
        call.idempotencyKey,
      );
      return;
    }

    if (!this.wallets.isAllowed(agent, call.contract, call.functionName)) {
      await this.store.audit(
        agent,
        call.functionName,
        'blocked',
        { reason: 'wallet policy denied', call },
        call.idempotencyKey,
      );
      throw new Error(
        `Wallet policy denied ${agent}.${call.functionName} on ${call.contract}`,
      );
    }

    if (!this.rateLimiter.tryConsume(`${agent}:wallet`)) {
      await this.store.audit(
        agent,
        call.functionName,
        'blocked',
        { reason: 'rate_limited', call },
        call.idempotencyKey,
      );
      throw new Error(`Rate limited wallet calls for ${agent}`);
    }

    // Only rotation, loan, governance may mutate chain state via wallets
    if (!['rotation', 'loan', 'governance'].includes(agent)) {
      await this.store.audit(
        agent,
        call.functionName,
        'blocked',
        { reason: 'agent is recommendation-only', call },
        call.idempotencyKey,
      );
      throw new Error(`Agent ${agent} is recommendation-only`);
    }

    const tx = await this.wallets.submit(agent, call);
    await this.store.audit(
      agent,
      call.functionName,
      'success',
      {
        decision,
        call,
        gasUsed: tx.gasUsed,
      },
      call.idempotencyKey,
      tx.transactionHash,
    );
    logger.info(
      {
        agent,
        functionName: call.functionName,
        tx: tx.transactionHash,
        gasUsed: tx.gasUsed,
      },
      'Agent wallet transaction confirmed',
    );
  }
}

function mapNotifType(type: string): NotifType {
  const allowed: NotifType[] = [
    'contribution',
    'deposit',
    'withdrawal',
    'loan',
    'proposal',
    'vote',
    'member',
    'ai',
    'treasury',
    'warning',
  ];
  return (allowed as string[]).includes(type)
    ? (type as NotifType)
    : type === 'fraud' || type === 'governance' || type === 'rotation'
      ? type === 'fraud'
        ? 'warning'
        : type === 'governance'
          ? 'proposal'
          : 'treasury'
      : 'ai';
}

export function createChainClient() {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(agentConfig.rpcUrl),
  });
}

export function configuredAddress(value?: string): Address | null {
  return value && /^0x[a-fA-F0-9]{40}$/.test(value)
    ? (value as Address)
    : null;
}

let singleton: AgentRuntime | null = null;

export function agentRuntime(): AgentRuntime {
  return (singleton ??= new AgentRuntime());
}

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

  async start(): Promise<void> {
    if (this.started) return;
    agentConfig.assertRunnable();
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

    this.timer = setInterval(
      () => void this.drain(),
      Math.max(1_000, agentConfig.pollIntervalMs),
    );
    this.started = true;
    await this.drain();
    logger.info(
      {
        agents: this.agents.map((a) => a.name),
        wallets: AGENT_NAMES.map((n) => ({
          agent: n,
          configured: Boolean(this.wallets.wallet(n)),
        })),
      },
      'Autonomous multi-agent runtime started',
    );
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers.length = 0;
    this.started = false;
  }

  async statuses(): Promise<AgentHealth[]> {
    const out: AgentHealth[] = [];
    for (const agent of AGENT_NAMES) {
      const base = this.health.get(agent) ?? {
        agent,
        ready: false,
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
    for (const agent of this.agents) {
      await this.drainAgent(agent);
    }
  }

  private async drainAgent(service: BaseAgent): Promise<void> {
    const agent = service.name;
    const task = await this.store.claim(agent);
    if (!task) return;

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

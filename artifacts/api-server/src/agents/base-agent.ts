import type {
  AgentHandleResult,
  AgentName,
  AgentServiceContext,
  DomainEvent,
  DomainEventName,
} from './types';
import type { DecisionEngine } from './decision-engine';

/**
 * Independent agent service contract.
 * Each agent is its own module with subscriptions, memory keys, and policy.
 * The runtime provides shared infrastructure (bus, queue, wallets, LLM).
 */
export abstract class BaseAgent {
  abstract readonly name: AgentName;
  abstract readonly subscriptions: readonly DomainEventName[];

  constructor(protected readonly decisionEngine: DecisionEngine) {}

  abstract handle(
    event: DomainEvent,
    ctx: AgentServiceContext,
  ): Promise<AgentHandleResult>;

  /** Optional periodic health tick (cron-style from runtime). */
  async tick(_ctx: AgentServiceContext): Promise<void> {
    // default no-op
  }

  protected noop(
    reasons: string[],
    evidence: Record<string, unknown> = {},
  ): AgentHandleResult {
    return {
      decision: {
        decision: 'noop',
        confidence: 1,
        reasons,
        risk: 'low',
        requiresHumanApproval: false,
        evidence,
      },
    };
  }

  protected recommendation(
    reasons: string[],
    evidence: Record<string, unknown>,
    risk: AgentHandleResult['decision']['risk'] = 'low',
  ): AgentHandleResult {
    return {
      decision: {
        decision: 'recommendation',
        confidence: 0.8,
        reasons,
        risk,
        requiresHumanApproval: false,
        evidence,
      },
      memoryUpdates: Object.entries(evidence).map(([key, value]) => ({
        key: `rec:${key}`,
        value,
      })),
    };
  }
}

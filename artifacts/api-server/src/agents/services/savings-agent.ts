import { BaseAgent } from '../base-agent';
import type {
  AgentHandleResult,
  AgentServiceContext,
  DomainEvent,
  DomainEventName,
} from '../types';

/**
 * Savings Agent — recommendations only. Never invests funds automatically.
 */
export class SavingsAgent extends BaseAgent {
  readonly name = 'savings' as const;
  readonly subscriptions: readonly DomainEventName[] = [
    'treasury.updated',
    'loan.repaid',
    'emergency.fund_released',
  ];

  async handle(
    event: DomainEvent,
    ctx: AgentServiceContext,
  ): Promise<AgentHandleResult> {
    const prior =
      (await ctx.recall<{ events: number; lastGrowthHint?: string }>(
        'savings_tracker',
      )) ?? { events: 0 };

    const tracker = {
      events: prior.events + 1,
      lastEvent: event.name,
      lastAt: event.occurredAt,
      payload: event.payload,
    };
    await ctx.remember('savings_tracker', tracker);

    const decision = await this.decisionEngine.decide(this.name, {
      event: event.name,
      tracker,
      policy: {
        neverInvestAutomatically: true,
        recommendationOnly: true,
        options: [
          'increase_savings',
          'pause_savings',
          'increase_loan_allocation',
          'increase_emergency_reserve',
        ],
      },
    });

    const recommendation = {
      at: event.occurredAt,
      decision: decision.decision,
      reasons: decision.reasons,
      risk: decision.risk,
      evidence: decision.evidence,
    };
    await ctx.remember('latest_savings_recommendation', recommendation);

    return {
      decision: {
        ...decision,
        decision: 'recommendation',
        requiresHumanApproval: true,
      },
      memoryUpdates: [
        { key: 'latest_savings_recommendation', value: recommendation },
      ],
    };
  }
}

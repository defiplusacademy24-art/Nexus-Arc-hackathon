import { BaseAgent } from '../base-agent';
import type {
  AgentHandleResult,
  AgentServiceContext,
  DomainEvent,
  DomainEventName,
} from '../types';

/**
 * Treasury Agent — monitors vault deposits, balances, allocations, reserve ratios.
 * Never moves funds without authorization (and never moves funds itself).
 */
export class TreasuryAgent extends BaseAgent {
  readonly name = 'treasury' as const;
  readonly subscriptions: readonly DomainEventName[] = [
    'treasury.updated',
    'contribution.received',
    'loan.repaid',
    'fraud.alert',
    'emergency.fund_released',
  ];

  async handle(
    event: DomainEvent,
    ctx: AgentServiceContext,
  ): Promise<AgentHandleResult> {
    const payload = event.payload;
    const snapshot = {
      event: event.name,
      at: event.occurredAt,
      tx: event.transactionHash,
      payload,
    };

    await ctx.remember('last_treasury_event', snapshot);
    await ctx.remember(`snapshot:${event.idempotencyKey}`, snapshot);

    // Heuristic anomaly flags before LLM enrichment
    const amount = Number(
      (payload as { amount?: unknown }).amount ??
        (payload as { decoded?: { amount?: unknown } }).decoded?.amount ??
        0,
    );
    const flags: string[] = [];
    if (Number.isFinite(amount) && amount < 0) flags.push('negative_amount');
    if (Number.isFinite(amount) && amount > 1_000_000e6) {
      flags.push('very_large_deposit');
    }

    const decision = await this.decisionEngine.decide(this.name, {
      event: event.name,
      snapshot,
      flags,
      policy: {
        neverMoveFunds: true,
        cannotModifyMembership: true,
        mayRecommendRebalancing: true,
      },
    });

    const notifications =
      flags.length > 0 || decision.risk === 'high' || decision.risk === 'critical'
        ? [
            {
              type: 'treasury',
              title: 'Treasury alert',
              description:
                decision.reasons[0] ??
                `Treasury event ${event.name} requires attention`,
              metadata: { flags, risk: decision.risk, eventId: event.id },
            },
          ]
        : [];

    return {
      decision: {
        ...decision,
        decision:
          decision.decision === 'approved'
            ? 'recommendation'
            : decision.decision,
        requiresHumanApproval:
          decision.requiresHumanApproval ||
          flags.includes('very_large_deposit'),
      },
      memoryUpdates: [
        { key: 'last_report', value: { decision, snapshot, flags } },
      ],
      notifications,
      followUpEvents:
        flags.length > 0
          ? [
              {
                name: 'fraud.alert' as const,
                source: this.name,
                idempotencyKey: `treasury-fraud:${event.idempotencyKey}`,
                payload: { flags, sourceEvent: event.id, snapshot },
              },
            ]
          : undefined,
    };
  }
}

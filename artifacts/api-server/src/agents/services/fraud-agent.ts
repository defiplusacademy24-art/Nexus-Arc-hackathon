import { BaseAgent } from '../base-agent';
import type {
  AgentHandleResult,
  AgentServiceContext,
  DomainEvent,
  DomainEventName,
  RiskLevel,
} from '../types';

/**
 * Fraud Detection Agent — continuous anomaly scoring. Never executes txs.
 */
export class FraudAgent extends BaseAgent {
  readonly name = 'fraud' as const;
  readonly subscriptions: readonly DomainEventName[] = [
    'member.joined',
    'contribution.received',
    'treasury.updated',
    'loan.applied',
    'loan.repaid',
    'fraud.alert',
  ];

  async handle(
    event: DomainEvent,
    ctx: AgentServiceContext,
  ): Promise<AgentHandleResult> {
    const signals: string[] = [];
    let heuristicRisk: RiskLevel = 'low';

    const decoded = (event.payload.decoded ?? event.payload) as Record<
      string,
      unknown
    >;
    const wallet = (
      (decoded.member as string) ||
      (decoded.borrower as string) ||
      (decoded.wallet as string) ||
      ''
    ).toLowerCase();

    if (wallet) {
      const seenKey = `wallet_seen:${wallet}`;
      const prior = await ctx.recall<{ count: number; events: string[] }>(
        seenKey,
      );
      const count = (prior?.count ?? 0) + 1;
      await ctx.remember(seenKey, {
        count,
        events: [...(prior?.events ?? []).slice(-20), event.name],
        lastAt: event.occurredAt,
      });
      if (count > 20) {
        signals.push('high_frequency_activity');
        heuristicRisk = 'medium';
      }
    }

    if (event.name === 'loan.applied') {
      const principal = Number(decoded.principal ?? 0);
      if (principal > 50_000e6) {
        signals.push('large_loan_request');
        heuristicRisk = 'high';
      }
      if (principal <= 0) {
        signals.push('invalid_loan_principal');
        heuristicRisk = 'medium';
      }
    }

    if (event.name === 'fraud.alert') {
      signals.push('upstream_fraud_alert');
      heuristicRisk = 'high';
    }

    const flags = Array.isArray(
      (event.payload as { flags?: unknown }).flags,
    )
      ? ((event.payload as { flags: string[] }).flags)
      : [];
    signals.push(...flags);

    const decision = await this.decisionEngine.decide(this.name, {
      event: event.name,
      signals,
      heuristicRisk,
      wallet,
      decoded,
      policy: {
        neverExecuteTransactions: true,
        preferFalsePositives: true,
      },
    });

    const rank: Record<RiskLevel, number> = {
      low: 0,
      medium: 1,
      high: 2,
      critical: 3,
    };
    const risk: RiskLevel =
      rank[decision.risk] >= rank[heuristicRisk] ? decision.risk : heuristicRisk;

    await ctx.remember(`alert:${event.idempotencyKey}`, {
      risk,
      signals,
      decision,
      at: event.occurredAt,
    });

    const escalate = risk === 'high' || risk === 'critical';

    return {
      decision: {
        ...decision,
        risk,
        decision: escalate ? 'notify' : decision.decision,
        evidence: { ...decision.evidence, signals, wallet },
      },
      followUpEvents:
        escalate && event.name !== 'fraud.alert'
          ? [
              {
                name: 'fraud.alert',
                source: this.name,
                idempotencyKey: `fraud-escalation:${event.idempotencyKey}`,
                payload: { risk, signals, wallet, sourceEvent: event.id },
              },
            ]
          : undefined,
      notifications: escalate
        ? [
            {
              type: 'warning',
              title: `${risk.toUpperCase()} risk alert`,
              description:
                decision.reasons[0] ??
                `Fraud signals detected: ${signals.join(', ') || 'review required'}`,
              metadata: { risk, signals, wallet },
            },
          ]
        : [],
    };
  }
}

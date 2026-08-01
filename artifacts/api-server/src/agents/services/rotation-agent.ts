import { BaseAgent } from '../base-agent';
import { agentConfig } from '../config';
import type {
  AgentHandleResult,
  AgentServiceContext,
  DomainEvent,
  DomainEventName,
  WalletCallRequest,
} from '../types';

/**
 * Rotation Agent — executes rotation payouts exactly once per completed cycle.
 */
export class RotationAgent extends BaseAgent {
  readonly name = 'rotation' as const;
  readonly subscriptions: readonly DomainEventName[] = [
    'contribution.received',
    'contribution.cycle_complete',
    'rotation.executed',
  ];

  async handle(
    event: DomainEvent,
    ctx: AgentServiceContext,
  ): Promise<AgentHandleResult> {
    if (event.name === 'rotation.executed') {
      const receipt = {
        at: event.occurredAt,
        tx: event.transactionHash,
        payload: event.payload,
      };
      await ctx.remember('last_payout_receipt', receipt);
      await ctx.remember(
        `payout:${event.idempotencyKey}`,
        receipt,
      );
      return {
        decision: {
          decision: 'notify',
          confidence: 1,
          reasons: ['Rotation executed on-chain; receipt stored'],
          risk: 'low',
          requiresHumanApproval: false,
          evidence: receipt,
        },
        notifications: [
          {
            type: 'treasury',
            title: 'Rotation payout executed',
            description: 'A cooperative rotation payout was confirmed on Arc.',
            metadata: receipt,
          },
        ],
      };
    }

    // Prevent double execution: memory key per coop + cycle
    const decoded = (event.payload.decoded ?? event.payload) as Record<
      string,
      unknown
    >;
    const coopId =
      decoded.coopId != null
        ? String(decoded.coopId)
        : String(
            (event.payload as { coopId?: unknown }).coopId ??
              'default',
          );
    const cycleKey = `rotation:executed:${coopId}:${
      decoded.cycle ?? decoded.rotationNumber ?? event.idempotencyKey
    }`;
    const already = await ctx.recall(cycleKey);
    if (already) {
      return this.noop(['Rotation already executed for this cycle'], {
        cycleKey,
        already,
      });
    }

    const ready =
      event.name === 'contribution.cycle_complete' ||
      Boolean((event.payload as { cycleComplete?: boolean }).cycleComplete);

    const decision = await this.decisionEngine.decide(this.name, {
      event: event.name,
      ready,
      coopId,
      cycleKey,
      decoded,
      priorExecution: already,
      policy: {
        neverDoublePayout: true,
        requireCycleComplete: true,
      },
    });

    const to = agentConfig.contractAddress('rotationManager');
    let walletCall: WalletCallRequest | undefined;

    if (
      ready &&
      decision.decision === 'approved' &&
      !decision.requiresHumanApproval &&
      to
    ) {
      walletCall = {
        contract: 'rotationManager',
        functionName: 'executeRotation',
        signature: 'executeRotation(uint256)',
        args: [coopId],
        to,
        idempotencyKey: cycleKey,
      };
    }

    return {
      decision: {
        ...decision,
        decision:
          !ready && decision.decision === 'approved'
            ? 'noop'
            : decision.decision,
        requiresHumanApproval:
          decision.requiresHumanApproval || !ready || !to,
        evidence: {
          ...decision.evidence,
          ready,
          coopId,
          walletConfigured: Boolean(ctx.wallet),
        },
      },
      walletCall,
      memoryUpdates: walletCall
        ? [{ key: cycleKey, value: { pending: true, at: event.occurredAt } }]
        : [],
    };
  }
}

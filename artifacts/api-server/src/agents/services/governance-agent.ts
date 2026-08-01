import { BaseAgent } from '../base-agent';
import type {
  AgentHandleResult,
  AgentServiceContext,
  DomainEvent,
  DomainEventName,
} from '../types';

/**
 * Governance Agent — proposals, votes, loan overrides.
 * Never executes failed proposals.
 */
export class GovernanceAgent extends BaseAgent {
  readonly name = 'governance' as const;
  readonly subscriptions: readonly DomainEventName[] = [
    'governance.proposal_created',
    'governance.vote_completed',
    'loan.applied',
    'emergency.fund_released',
  ];

  async handle(
    event: DomainEvent,
    ctx: AgentServiceContext,
  ): Promise<AgentHandleResult> {
    const proposalId =
      String(
        (event.payload as { proposalId?: unknown }).proposalId ??
          (event.payload as { loanId?: unknown }).loanId ??
          event.idempotencyKey,
      );

    if (event.name === 'governance.proposal_created' || event.name === 'loan.applied') {
      const summary = {
        proposalId,
        type: (event.payload as { type?: string }).type ?? event.name,
        payload: event.payload,
        status: 'open',
        createdAt: event.occurredAt,
      };
      await ctx.remember(`proposal:${proposalId}`, summary);

      const decision = await this.decisionEngine.decide(this.name, {
        phase: 'summarize',
        summary,
      });

      return {
        decision: {
          ...decision,
          decision: 'notify',
        },
        notifications: [
          {
            type: 'proposal',
            title: 'New governance item',
            description:
              decision.reasons[0] ??
              'A cooperative proposal or loan override needs member attention.',
            metadata: summary,
          },
        ],
        memoryUpdates: [{ key: `proposal:${proposalId}`, value: summary }],
      };
    }

    if (event.name === 'governance.vote_completed') {
      const passed = Boolean(
        (event.payload as { passed?: unknown }).passed ??
          (event.payload as { approved?: unknown }).approved,
      );
      const prior = await ctx.recall(`proposal:${proposalId}`);
      const record = {
        proposalId,
        prior,
        passed,
        completedAt: event.occurredAt,
        payload: event.payload,
      };
      await ctx.remember(`proposal:${proposalId}:result`, record);

      if (!passed) {
        return {
          decision: {
            decision: 'noop',
            confidence: 1,
            reasons: ['Proposal failed — will not execute'],
            risk: 'low',
            requiresHumanApproval: false,
            evidence: record,
          },
        };
      }

      const decision = await this.decisionEngine.decide(this.name, {
        phase: 'execute_check',
        record,
        policy: {
          neverExecuteFailed: true,
          requireVerifiedVotes: true,
        },
      });

      // On-chain governance execution is cooperative-specific; log intent only
      // unless a validated wallet command is attached to the payload.
      return {
        decision: {
          ...decision,
          requiresHumanApproval:
            decision.requiresHumanApproval ||
            decision.decision !== 'approved',
        },
        memoryUpdates: [
          {
            key: `proposal:${proposalId}:execution`,
            value: { decision, at: event.occurredAt },
          },
        ],
        notifications: [
          {
            type: 'vote',
            title: passed ? 'Proposal passed' : 'Proposal failed',
            description: decision.reasons[0] ?? 'Vote completed.',
            metadata: record,
          },
        ],
      };
    }

    return this.noop(['Unhandled governance event'], { event: event.name });
  }
}

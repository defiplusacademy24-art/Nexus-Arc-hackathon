import { BaseAgent } from '../base-agent';
import type {
  AgentHandleResult,
  AgentServiceContext,
  DomainEvent,
  DomainEventName,
} from '../types';

/**
 * Contribution Agent — deadlines, missed contributions, cycle completion.
 * Notifies Rotation when every required contribution is received.
 */
export class ContributionAgent extends BaseAgent {
  readonly name = 'contribution' as const;
  readonly subscriptions: readonly DomainEventName[] = [
    'member.joined',
    'contribution.received',
  ];

  async handle(
    event: DomainEvent,
    ctx: AgentServiceContext,
  ): Promise<AgentHandleResult> {
    const prior =
      (await ctx.recall<Record<string, unknown>>('contribution_stats')) ?? {
        received: 0,
        members: [] as string[],
      };

    const decoded = (event.payload.decoded ?? event.payload) as Record<
      string,
      unknown
    >;
    const member =
      typeof decoded.member === 'string'
        ? decoded.member.toLowerCase()
        : typeof decoded.wallet === 'string'
          ? decoded.wallet.toLowerCase()
          : undefined;

    const members = new Set(
      Array.isArray(prior.members)
        ? (prior.members as string[]).map((m) => m.toLowerCase())
        : [],
    );
    if (member) members.add(member);

    const received =
      event.name === 'contribution.received'
        ? Number(prior.received ?? 0) + 1
        : Number(prior.received ?? 0);

    const stats = {
      received,
      members: [...members],
      lastEvent: event.name,
      lastAt: event.occurredAt,
      lastMember: member,
    };
    await ctx.remember('contribution_stats', stats);

    const expectedMembers = Number(
      (event.payload as { expectedMembers?: unknown }).expectedMembers ??
        members.size,
    );
    const cycleComplete =
      event.name === 'contribution.received' &&
      expectedMembers > 0 &&
      received >= expectedMembers;

    const decision = await this.decisionEngine.decide(this.name, {
      event: event.name,
      stats,
      expectedMembers,
      cycleComplete,
      decoded,
    });

    const followUpEvents: AgentHandleResult['followUpEvents'] = [];
    if (cycleComplete) {
      followUpEvents.push({
        name: 'contribution.cycle_complete',
        source: this.name,
        idempotencyKey: `cycle-complete:${event.idempotencyKey}`,
        payload: {
          stats,
          expectedMembers,
          triggeredBy: event.id,
        },
      });
    }

    const notifications =
      event.name === 'member.joined'
        ? [
            {
              recipientWallet: member,
              type: 'member',
              title: 'Welcome to the cooperative',
              description:
                'You joined successfully. Contribution deadlines will appear on your dashboard.',
              metadata: { event: event.name },
            },
          ]
        : event.name === 'contribution.received' && member
          ? [
              {
                recipientWallet: member,
                type: 'contribution',
                title: 'Contribution received',
                description: 'Your contribution was recorded on-chain.',
                metadata: { event: event.name, tx: event.transactionHash },
              },
            ]
          : [];

    return {
      decision: {
        ...decision,
        decision: cycleComplete ? 'notify' : decision.decision,
      },
      memoryUpdates: [{ key: 'contribution_stats', value: stats }],
      followUpEvents,
      notifications,
    };
  }
}

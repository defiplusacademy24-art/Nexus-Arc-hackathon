import { BaseAgent } from '../base-agent';
import { quoteLoanInterest } from '../interest';
import type {
  AgentHandleResult,
  AgentServiceContext,
  DomainEvent,
  DomainEventName,
} from '../types';

/**
 * Nexa AI Assistant — member-scoped financial Q&A.
 * Never exposes other members' sensitive data.
 */
export class NexaAgent extends BaseAgent {
  readonly name = 'nexa' as const;
  readonly subscriptions: readonly DomainEventName[] = [
    'nexa.question',
    'member.joined',
    'contribution.received',
    'loan.approved',
    'rotation.executed',
    'treasury.updated',
  ];

  async handle(
    event: DomainEvent,
    ctx: AgentServiceContext,
  ): Promise<AgentHandleResult> {
    if (event.name !== 'nexa.question') {
      // Keep a rolling activity summary for the assistant (aggregate only).
      const activity =
        (await ctx.recall<{ events: string[] }>('public_activity')) ?? {
          events: [],
        };
      const events = [
        ...activity.events.slice(-40),
        `${event.occurredAt}:${event.name}`,
      ];
      await ctx.remember('public_activity', { events });
      return this.noop(['Activity memory updated'], { event: event.name });
    }

    const question = String(
      (event.payload as { question?: unknown }).question ?? '',
    ).trim();
    const memberWallet = String(
      (event.payload as { memberWallet?: unknown }).memberWallet ?? '',
    )
      .trim()
      .toLowerCase();

    if (!question || !memberWallet) {
      return {
        decision: {
          decision: 'rejected',
          confidence: 1,
          reasons: ['question and memberWallet are required'],
          risk: 'low',
          requiresHumanApproval: false,
          evidence: {},
        },
      };
    }

    // Member-scoped context only — never inject other members' private rows.
    const memberContext = {
      memberWallet,
      // Callers (API) should attach only this member's facts:
      memberFacts: (event.payload as { memberFacts?: unknown }).memberFacts ?? {},
      cooperativePublic: {
        // Non-sensitive aggregates only
        treasuryHealth: (event.payload as { treasuryHealth?: unknown })
          .treasuryHealth,
        activity: await ctx.recall('public_activity'),
      },
      interestSchedule: {
        1: '5%',
        2: '6%',
        3: '7%',
        4: '8%',
        5: '9%',
        6: '10%',
      },
      sampleLoanQuote: safeQuote(event.payload),
    };

    const { answer, decision } = await this.decisionEngine.answer(
      this.name,
      question,
      memberContext,
    );

    await ctx.remember(`qa:${event.idempotencyKey}`, {
      memberWallet,
      question,
      answer,
      at: event.occurredAt,
    });

    return {
      decision: {
        ...decision,
        evidence: {
          ...decision.evidence,
          answer,
          memberWallet,
          // Deliberately omit other members
        },
      },
      memoryUpdates: [
        {
          key: `last_answer:${memberWallet}`,
          value: { question, answer, at: event.occurredAt },
        },
      ],
    };
  }
}

function safeQuote(payload: Record<string, unknown>) {
  const principal = Number(
    (payload.memberFacts as { loanPrincipal?: unknown } | undefined)
      ?.loanPrincipal ?? payload.loanPrincipal ?? 0,
  );
  const termMonths = Number(
    (payload.memberFacts as { termMonths?: unknown } | undefined)
      ?.termMonths ?? payload.termMonths ?? 0,
  );
  if (!(principal > 0) || termMonths < 1 || termMonths > 6) return null;
  try {
    return quoteLoanInterest(principal, termMonths);
  } catch {
    return null;
  }
}

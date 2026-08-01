import { BaseAgent } from '../base-agent';
import type {
  AgentHandleResult,
  AgentServiceContext,
  DomainEvent,
  DomainEventName,
} from '../types';
import {
  createNotification,
  type CreateNotificationInput,
  type NotifType,
} from '../../lib/store';
import { publishNotification } from '../../lib/events';
import { logger } from '../../lib/logger';

const EVENT_COPY: Partial<
  Record<
    DomainEventName,
    { type: NotifType; title: string; description: string }
  >
> = {
  'member.joined': {
    type: 'member',
    title: 'New member joined',
    description: 'A new member joined the cooperative.',
  },
  'contribution.received': {
    type: 'contribution',
    title: 'Contribution received',
    description: 'A contribution was confirmed on-chain.',
  },
  'loan.approved': {
    type: 'loan',
    title: 'Loan approved',
    description: 'A loan was approved and will be disbursed by the Loan Pool.',
  },
  'loan.repaid': {
    type: 'loan',
    title: 'Loan repayment',
    description: 'A loan repayment was recorded.',
  },
  'rotation.executed': {
    type: 'treasury',
    title: 'Rotation payout',
    description: 'A rotation payout was executed.',
  },
  'governance.proposal_created': {
    type: 'proposal',
    title: 'Governance proposal',
    description: 'A new governance proposal is open for review.',
  },
  'fraud.alert': {
    type: 'warning',
    title: 'Risk alert',
    description: 'Fraud detection raised a risk alert for cooperative review.',
  },
  'notification.requested': {
    type: 'ai',
    title: 'Notification',
    description: 'You have a new cooperative notification.',
  },
};

function asNotifType(value: string | undefined, fallback: NotifType): NotifType {
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
  return value && (allowed as string[]).includes(value)
    ? (value as NotifType)
    : fallback;
}

/**
 * Notification Agent — dashboard notifications (+ future email/push).
 */
export class NotificationAgent extends BaseAgent {
  readonly name = 'notification' as const;
  readonly subscriptions: readonly DomainEventName[] = [
    'member.joined',
    'contribution.received',
    'loan.approved',
    'loan.repaid',
    'rotation.executed',
    'governance.proposal_created',
    'fraud.alert',
    'notification.requested',
  ];

  async handle(
    event: DomainEvent,
    ctx: AgentServiceContext,
  ): Promise<AgentHandleResult> {
    const payload = event.payload as {
      recipientWallet?: string;
      coopId?: string;
      title?: string;
      description?: string;
      type?: string;
      metadata?: Record<string, unknown>;
    };

    const template = EVENT_COPY[event.name];
    const title = payload.title ?? template?.title ?? 'Nexusu update';
    const description =
      payload.description ?? template?.description ?? `Event: ${event.name}`;
    const type = asNotifType(payload.type, template?.type ?? 'ai');

    const decision = await this.decisionEngine.decide(this.name, {
      event: event.name,
      title,
      description,
      type,
      recipientWallet: payload.recipientWallet,
    });

    if (payload.recipientWallet) {
      try {
        const input: CreateNotificationInput = {
          recipientWallet: payload.recipientWallet,
          coopId: payload.coopId,
          type,
          title,
          description,
          metadata: {
            ...(payload.metadata ?? {}),
            agentEvent: event.name,
            eventId: event.id,
            tx: event.transactionHash,
          },
        };
        const created = await createNotification(input);
        publishNotification(created);
        await ctx.remember(`sent:${event.idempotencyKey}`, {
          notificationId: created.id,
          at: event.occurredAt,
        });
      } catch (error) {
        logger.warn(
          { err: error, event: event.name },
          'Notification persistence failed; auditing only',
        );
      }
    } else {
      await ctx.remember(`broadcast:${event.idempotencyKey}`, {
        title,
        description,
        type,
        at: event.occurredAt,
      });
    }

    return {
      decision: {
        ...decision,
        decision: 'notify',
        evidence: {
          ...decision.evidence,
          title,
          description,
          recipientWallet: payload.recipientWallet,
        },
      },
    };
  }
}

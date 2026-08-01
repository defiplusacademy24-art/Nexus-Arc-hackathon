import { BaseAgent } from '../base-agent';
import { agentConfig } from '../config';
import { quoteLoanInterest } from '../interest';
import type {
  AgentHandleResult,
  AgentServiceContext,
  DomainEvent,
  DomainEventName,
  WalletCallRequest,
} from '../types';

/**
 * Loan Agent — evaluates applications, optional autonomous approve/reject,
 * monitors repayments. Interest schedule matches CooperativeLoanPool.
 */
export class LoanAgent extends BaseAgent {
  readonly name = 'loan' as const;
  readonly subscriptions: readonly DomainEventName[] = [
    'loan.applied',
    'loan.approved',
    'loan.repaid',
    'loan.rejected',
  ];

  async handle(
    event: DomainEvent,
    ctx: AgentServiceContext,
  ): Promise<AgentHandleResult> {
    const decoded = (event.payload.decoded ?? event.payload) as Record<
      string,
      unknown
    >;
    const loanId =
      decoded.loanId != null ? String(decoded.loanId) : undefined;
    const principal = Number(decoded.principal ?? 0);
    const termMonths = Number(decoded.termMonths ?? 0);
    const borrower =
      typeof decoded.borrower === 'string'
        ? decoded.borrower.toLowerCase()
        : undefined;

    let quote: ReturnType<typeof quoteLoanInterest> | null = null;
    if (principal > 0 && termMonths >= 1 && termMonths <= 6) {
      try {
        quote = quoteLoanInterest(principal, termMonths);
      } catch {
        quote = null;
      }
    }

    if (event.name === 'loan.repaid') {
      const repayment = {
        loanId,
        borrower,
        amount: decoded.amount,
        principalPortion: decoded.principalPortion,
        interestPortion: decoded.interestPortion,
        remaining: decoded.remaining,
        fullyPaid: decoded.fullyPaid,
        at: event.occurredAt,
        tx: event.transactionHash,
      };
      await ctx.remember(`repayment:${loanId ?? event.idempotencyKey}`, repayment);

      return {
        decision: {
          decision: 'notify',
          confidence: 1,
          reasons: [
            'Loan repayment recorded; principal returns to pool, interest is cooperative profit',
          ],
          risk: 'low',
          requiresHumanApproval: false,
          evidence: { repayment, quote },
        },
        followUpEvents: [
          {
            name: 'treasury.updated',
            source: this.name,
            idempotencyKey: `loan-repay-treasury:${event.idempotencyKey}`,
            payload: { reason: 'loan_repaid', repayment },
          },
        ],
        notifications: borrower
          ? [
              {
                recipientWallet: borrower,
                type: 'loan',
                title: decoded.fullyPaid
                  ? 'Loan fully repaid'
                  : 'Loan repayment received',
                description: decoded.fullyPaid
                  ? 'Your cooperative loan is fully paid. Thank you.'
                  : 'A loan repayment was confirmed on-chain.',
                metadata: repayment,
              },
            ]
          : [],
      };
    }

    if (event.name === 'loan.approved' || event.name === 'loan.rejected') {
      await ctx.remember(`loan_status:${loanId}`, {
        status: event.name,
        at: event.occurredAt,
        payload: decoded,
      });
      return {
        decision: {
          decision: 'notify',
          confidence: 1,
          reasons: [`On-chain ${event.name}`],
          risk: 'low',
          requiresHumanApproval: false,
          evidence: { decoded },
        },
        notifications: borrower
          ? [
              {
                recipientWallet: borrower,
                type: 'loan',
                title:
                  event.name === 'loan.approved'
                    ? 'Loan approved'
                    : 'Loan rejected',
                description:
                  event.name === 'loan.approved'
                    ? 'Your loan was approved and principal will be disbursed by the Loan Pool contract.'
                    : 'Your loan application was rejected.',
                metadata: { loanId, event: event.name },
              },
            ]
          : [],
      };
    }

    // loan.applied
    const creditScore = Number(
      (event.payload as { creditScore?: unknown }).creditScore ?? 70,
    );
    const riskScore = Number(
      (event.payload as { riskScore?: unknown }).riskScore ?? 30,
    );
    const autonomousAllowed = Boolean(
      (event.payload as { autonomousApproval?: unknown }).autonomousApproval,
    );

    const decision = await this.decisionEngine.decide(this.name, {
      event: event.name,
      loanId,
      borrower,
      principal,
      termMonths,
      quote,
      creditScore,
      riskScore,
      autonomousAllowed,
      policy: {
        interestSchedule: {
          1: '5%',
          2: '6%',
          3: '7%',
          4: '8%',
          5: '9%',
          6: '10%',
        },
        failClosedOnMissingEvidence: true,
        preferGovernanceWhenUnsure: true,
      },
    });

    const to = agentConfig.contractAddress('loanPool');
    let walletCall: WalletCallRequest | undefined;
    const followUpEvents: AgentHandleResult['followUpEvents'] = [];

    const canAct =
      loanId &&
      to &&
      !decision.requiresHumanApproval &&
      autonomousAllowed &&
      (decision.decision === 'approved' || decision.decision === 'rejected');

    if (canAct && decision.decision === 'approved') {
      walletCall = {
        contract: 'loanPool',
        functionName: 'approveLoan',
        signature: 'approveLoan(uint256)',
        args: [loanId!],
        to,
        idempotencyKey: `loan:approve:${loanId}`,
      };
    } else if (canAct && decision.decision === 'rejected') {
      walletCall = {
        contract: 'loanPool',
        functionName: 'rejectLoan',
        signature: 'rejectLoan(uint256)',
        args: [loanId!],
        to,
        idempotencyKey: `loan:reject:${loanId}`,
      };
    } else if (
      decision.decision === 'governance_review' ||
      !autonomousAllowed ||
      decision.requiresHumanApproval
    ) {
      followUpEvents.push({
        name: 'governance.proposal_created',
        source: this.name,
        idempotencyKey: `loan-gov:${loanId ?? event.idempotencyKey}`,
        payload: {
          type: 'loan_override',
          loanId,
          borrower,
          principal,
          termMonths,
          quote,
          decision,
        },
      });
    }

    await ctx.remember(`loan_decision:${loanId ?? event.idempotencyKey}`, {
      decision,
      quote,
      at: event.occurredAt,
    });

    return {
      decision: {
        ...decision,
        evidence: {
          ...decision.evidence,
          quote,
          creditScore,
          riskScore,
          autonomousAllowed,
        },
      },
      walletCall,
      followUpEvents,
      notifications:
        decision.decision === 'governance_review'
          ? [
              {
                recipientWallet: borrower,
                type: 'loan',
                title: 'Loan under governance review',
                description:
                  'Your application needs cooperative governance review before approval.',
                metadata: { loanId },
              },
            ]
          : [],
    };
  }
}

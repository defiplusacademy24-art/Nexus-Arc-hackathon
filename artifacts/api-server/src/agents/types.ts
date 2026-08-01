/**
 * Shared types for the Nexusu autonomous multi-agent runtime.
 * Agents never hold funds — they observe chain state, decide under policy,
 * and call approved contract functions via independent Circle Agent Wallets.
 */

export const AGENT_NAMES = [
  'treasury',
  'contribution',
  'rotation',
  'loan',
  'savings',
  'governance',
  'fraud',
  'nexa',
  'notification',
] as const;

export type AgentName = (typeof AGENT_NAMES)[number];

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type Decision =
  | 'approved'
  | 'rejected'
  | 'governance_review'
  | 'recommendation'
  | 'notify'
  | 'noop';

export type DomainEventName =
  | 'member.joined'
  | 'contribution.received'
  | 'contribution.cycle_complete'
  | 'treasury.updated'
  | 'loan.applied'
  | 'loan.approved'
  | 'loan.rejected'
  | 'loan.repaid'
  | 'rotation.executed'
  | 'governance.proposal_created'
  | 'governance.vote_completed'
  | 'emergency.fund_released'
  | 'fraud.alert'
  | 'notification.requested'
  | 'nexa.question';

export type ContractName =
  | 'registry'
  | 'treasury'
  | 'loanPool'
  | 'rotationManager';

export interface DomainEvent<T = Record<string, unknown>> {
  id: string;
  name: DomainEventName;
  source: 'chain' | AgentName | 'api';
  occurredAt: string;
  idempotencyKey: string;
  transactionHash?: string;
  blockNumber?: bigint | string;
  payload: T;
}

export interface AgentTask {
  id: string;
  agent: AgentName;
  event: DomainEvent;
  attempts: number;
  maxAttempts: number;
  runAfter: Date;
}

export interface AgentDecision {
  decision: Decision;
  confidence: number;
  reasons: string[];
  risk: RiskLevel;
  requiresHumanApproval: boolean;
  evidence: Record<string, unknown>;
  /** Optional structured follow-up for the runtime (notifications, side effects). */
  actions?: AgentAction[];
}

export interface AgentAction {
  type:
    | 'wallet_call'
    | 'notify'
    | 'emit_event'
    | 'remember'
    | 'recommend';
  detail: Record<string, unknown>;
}

export interface AgentHealth {
  agent: AgentName;
  ready: boolean;
  queueDepth: number;
  lastEventAt?: string;
  lastDecisionAt?: string;
  lastError?: string;
  walletConfigured: boolean;
  walletAddress?: `0x${string}`;
}

export interface ContractPermission {
  contract: ContractName;
  functions: readonly string[];
}

export interface AgentWallet {
  agent: AgentName;
  address: `0x${string}`;
  allowedContracts: readonly ContractPermission[];
}

export interface WalletCallRequest {
  contract: ContractName;
  functionName: string;
  signature: string;
  args: string[];
  to: `0x${string}`;
  idempotencyKey: string;
  value?: string;
}

export interface WalletCallResult {
  transactionHash: string;
  gasUsed?: string;
}

/** Result of one agent handling one domain event. */
export interface AgentHandleResult {
  decision: AgentDecision;
  walletCall?: WalletCallRequest;
  followUpEvents?: Array<Omit<DomainEvent, 'id' | 'occurredAt'>>;
  memoryUpdates?: Array<{ key: string; value: unknown }>;
  notifications?: Array<{
    recipientWallet?: string;
    coopId?: string;
    type: string;
    title: string;
    description: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface LoanInterestQuote {
  termMonths: number;
  interestRatePercent: number;
  interestBps: number;
  principal: number;
  totalInterest: number;
  totalRepayment: number;
  monthlyPayment: number;
  remainingBalance: number;
  interestEarned: number;
}

export interface AgentServiceContext {
  remember: (key: string, value: unknown) => Promise<void>;
  recall: <T = unknown>(key: string) => Promise<T | null>;
  audit: (
    action: string,
    status: 'success' | 'blocked' | 'error',
    detail: unknown,
    idempotencyKey?: string,
    txHash?: string,
  ) => Promise<void>;
  wallet: AgentWallet | null;
}

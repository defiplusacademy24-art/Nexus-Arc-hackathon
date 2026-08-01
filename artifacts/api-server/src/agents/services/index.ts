import type { DecisionEngine } from '../decision-engine';
import type { BaseAgent } from '../base-agent';
import { TreasuryAgent } from './treasury-agent';
import { ContributionAgent } from './contribution-agent';
import { RotationAgent } from './rotation-agent';
import { LoanAgent } from './loan-agent';
import { SavingsAgent } from './savings-agent';
import { GovernanceAgent } from './governance-agent';
import { FraudAgent } from './fraud-agent';
import { NexaAgent } from './nexa-agent';
import { NotificationAgent } from './notification-agent';

/** Factory: each agent is an independent service instance (never a monolith). */
export function createAgentServices(decision: DecisionEngine): BaseAgent[] {
  return [
    new TreasuryAgent(decision),
    new ContributionAgent(decision),
    new RotationAgent(decision),
    new LoanAgent(decision),
    new SavingsAgent(decision),
    new GovernanceAgent(decision),
    new FraudAgent(decision),
    new NexaAgent(decision),
    new NotificationAgent(decision),
  ];
}

export {
  TreasuryAgent,
  ContributionAgent,
  RotationAgent,
  LoanAgent,
  SavingsAgent,
  GovernanceAgent,
  FraudAgent,
  NexaAgent,
  NotificationAgent,
};

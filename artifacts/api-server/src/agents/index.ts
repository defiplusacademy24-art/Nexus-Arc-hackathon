/**
 * Nexusu autonomous multi-agent architecture
 *
 * Agents never custody funds. All capital remains in smart contracts on Arc.
 * Each agent has its own Circle Agent Wallet, memory, subscriptions, and tools.
 */

export { AGENT_NAMES } from './types';
export type {
  AgentName,
  AgentHealth,
  AgentDecision,
  DomainEvent,
  DomainEventName,
  LoanInterestQuote,
} from './types';

export { agentConfig } from './config';
export { agentRuntime, AgentRuntime } from './runtime';
export { startChainListeners } from './chain-listener';
export { quoteLoanInterest, INTEREST_BPS_BY_TERM } from './interest';
export { AGENT_PROMPTS, promptFor } from './prompts';
export { AGENT_TOOLS, toolsFor } from './tools';
export { createAgentServices } from './services';

/**
 * Tool catalog exposed to agents / decision engine.
 * Mutating tools are gated by Circle wallet allowlists at execution time.
 */

import type { AgentName, ContractName } from '../types';
import { INTEREST_BPS_BY_TERM } from '../interest';

export type ToolKind = 'read' | 'write' | 'compute' | 'notify';

export interface AgentToolDefinition {
  name: string;
  kind: ToolKind;
  description: string;
  agents: readonly AgentName[];
  contract?: ContractName;
  functionName?: string;
  signature?: string;
}

export const AGENT_TOOLS: readonly AgentToolDefinition[] = [
  {
    name: 'treasury.getBalance',
    kind: 'read',
    description: 'Read total USDC balance of the Treasury Vault',
    agents: ['treasury', 'savings', 'loan', 'nexa', 'fraud'],
    contract: 'treasury',
    functionName: 'getTreasuryBalance',
    signature: 'getTreasuryBalance()',
  },
  {
    name: 'treasury.getAllocation',
    kind: 'read',
    description: 'Read loan/savings/emergency/rotation allocation breakdown',
    agents: ['treasury', 'savings', 'loan', 'nexa'],
    contract: 'treasury',
    functionName: 'getTreasuryAllocationBreakdown',
    signature: 'getTreasuryAllocationBreakdown()',
  },
  {
    name: 'registry.getMembers',
    kind: 'read',
    description: 'List cooperative member addresses',
    agents: ['contribution', 'governance', 'fraud'],
    contract: 'registry',
    functionName: 'getMembers',
    signature: 'getMembers(uint256)',
  },
  {
    name: 'registry.getMember',
    kind: 'read',
    description: 'Read a single member record from the registry',
    agents: ['contribution', 'loan', 'nexa', 'fraud'],
    contract: 'registry',
    functionName: 'getMember',
    signature: 'getMember(uint256,address)',
  },
  {
    name: 'rotation.getState',
    kind: 'read',
    description: 'Read current/next/previous rotation recipients and counters',
    agents: ['rotation', 'contribution', 'nexa'],
    contract: 'rotationManager',
    functionName: 'getRotationState',
    signature: 'getRotationState(uint256)',
  },
  {
    name: 'rotation.execute',
    kind: 'write',
    description: 'Execute rotation payout via Rotation Manager (once per cycle)',
    agents: ['rotation'],
    contract: 'rotationManager',
    functionName: 'executeRotation',
    signature: 'executeRotation(uint256)',
  },
  {
    name: 'loan.getLoan',
    kind: 'read',
    description: 'Read loan struct from Loan Pool',
    agents: ['loan', 'nexa', 'fraud'],
    contract: 'loanPool',
    functionName: 'getLoan',
    signature: 'getLoan(uint256)',
  },
  {
    name: 'loan.availableLiquidity',
    kind: 'read',
    description: 'Read available liquidity for new disbursements',
    agents: ['loan', 'treasury', 'nexa'],
    contract: 'loanPool',
    functionName: 'availableLiquidity',
    signature: 'availableLiquidity()',
  },
  {
    name: 'loan.approve',
    kind: 'write',
    description: 'Approve and disburse a pending loan (lending agent wallet)',
    agents: ['loan'],
    contract: 'loanPool',
    functionName: 'approveLoan',
    signature: 'approveLoan(uint256)',
  },
  {
    name: 'loan.reject',
    kind: 'write',
    description: 'Reject a pending loan application',
    agents: ['loan'],
    contract: 'loanPool',
    functionName: 'rejectLoan',
    signature: 'rejectLoan(uint256)',
  },
  {
    name: 'loan.quoteInterest',
    kind: 'compute',
    description: `Quote simple interest using schedule ${JSON.stringify(INTEREST_BPS_BY_TERM)}`,
    agents: ['loan', 'nexa'],
  },
  {
    name: 'notify.member',
    kind: 'notify',
    description: 'Queue a member-facing dashboard/email notification',
    agents: ['notification', 'contribution', 'loan', 'rotation', 'governance', 'fraud', 'treasury'],
  },
] as const;

export function toolsFor(agent: AgentName): AgentToolDefinition[] {
  return AGENT_TOOLS.filter((t) => t.agents.includes(agent));
}

export function mutatingToolsFor(agent: AgentName): AgentToolDefinition[] {
  return toolsFor(agent).filter((t) => t.kind === 'write');
}

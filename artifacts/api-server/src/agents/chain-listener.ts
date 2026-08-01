import {
  createPublicClient,
  decodeEventLog,
  http,
  type Address,
  type Log,
} from 'viem';
import { arcTestnet } from 'viem/chains';
import { agentConfig } from './config';
import { contractAbis } from './abis';
import type { AgentRuntime } from './runtime';
import type { ContractName, DomainEventName } from './types';
import { logger } from '../lib/logger';

type WatchSpec = {
  contract: ContractName;
  eventName: string;
  domainEvent: DomainEventName;
};

/**
 * Maps on-chain contract events → domain events for the agent bus.
 * Agents react automatically; the durable ledger de-duplicates RPC replay.
 */
const WATCHED: readonly WatchSpec[] = [
  { contract: 'registry', eventName: 'MemberJoined', domainEvent: 'member.joined' },
  {
    contract: 'treasury',
    eventName: 'ContributionDeposited',
    domainEvent: 'contribution.received',
  },
  {
    contract: 'treasury',
    eventName: 'AllocationUpdated',
    domainEvent: 'treasury.updated',
  },
  {
    contract: 'treasury',
    eventName: 'PayoutExecuted',
    domainEvent: 'rotation.executed',
  },
  {
    contract: 'loanPool',
    eventName: 'LoanApplied',
    domainEvent: 'loan.applied',
  },
  {
    contract: 'loanPool',
    eventName: 'LoanApproved',
    domainEvent: 'loan.approved',
  },
  {
    contract: 'loanPool',
    eventName: 'LoanRejected',
    domainEvent: 'loan.rejected',
  },
  {
    contract: 'loanPool',
    eventName: 'LoanRepaid',
    domainEvent: 'loan.repaid',
  },
  {
    contract: 'rotationManager',
    eventName: 'RotationExecuted',
    domainEvent: 'rotation.executed',
  },
];

function configuredAddress(value?: string): Address | null {
  return value && /^0x[a-fA-F0-9]{40}$/.test(value)
    ? (value as Address)
    : null;
}

function decodeLog(
  contract: ContractName,
  eventName: string,
  log: Log,
): Record<string, unknown> | null {
  try {
    const abi = contractAbis[contract];
    const decoded = decodeEventLog({
      abi,
      data: log.data,
      topics: log.topics,
    });
    if (decoded.eventName !== eventName) return null;
    const args = decoded.args as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(args ?? {})) {
      normalized[k] =
        typeof v === 'bigint'
          ? v.toString()
          : Array.isArray(v)
            ? v.map(String)
            : v;
    }
    return normalized;
  } catch {
    return null;
  }
}

function handleLogs(
  runtime: AgentRuntime,
  spec: WatchSpec,
  address: Address,
  logs: Log[],
): void {
  for (const log of logs) {
    // Skip logs that are not this event (address may emit multiple event types).
    const decoded = decodeLog(spec.contract, spec.eventName, log);
    if (!decoded) continue;

    const txHash = log.transactionHash ?? 'unknown';
    const logIndex = log.logIndex ?? 0;
    const idempotencyKey = `${txHash}:${logIndex}`;
    void runtime.emit({
      name: spec.domainEvent,
      source: 'chain',
      idempotencyKey,
      transactionHash: log.transactionHash ?? undefined,
      blockNumber: log.blockNumber ?? undefined,
      payload: {
        contract: spec.contract,
        event: spec.eventName,
        address,
        decoded,
        topics: log.topics,
        data: log.data,
      },
    });
  }
}

/** Polls finalized logs via viem watchEvent. Returns a stop function. */
export function startChainListeners(runtime: AgentRuntime): () => void {
  const client = createPublicClient({
    chain: arcTestnet,
    transport: http(agentConfig.rpcUrl),
  });

  const stops: Array<() => void> = [];

  for (const spec of WATCHED) {
    const address = configuredAddress(agentConfig.contracts[spec.contract]);
    if (!address) {
      logger.warn(
        { contract: spec.contract },
        'Skipping chain listener — address not configured',
      );
      continue;
    }

    // Use watchEvent + manual decode so TypeScript does not collapse log types
    // when filtering by dynamic eventName across heterogeneous ABIs.
    const stop = client.watchEvent({
      address,
      onLogs: (logs) => handleLogs(runtime, spec, address, logs as Log[]),
      onError: (error) => {
        logger.error(
          { err: error, contract: spec.contract, event: spec.eventName },
          'Chain listener error',
        );
      },
    });
    stops.push(stop);
  }

  logger.info(
    { watchers: stops.length, rpc: agentConfig.rpcUrl },
    'Chain listeners started',
  );

  return () => {
    for (const stop of stops) stop();
  };
}

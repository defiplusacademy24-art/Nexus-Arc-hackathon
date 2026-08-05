import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { agentConfig } from './config';
import type {
  AgentName,
  AgentWallet,
  ContractPermission,
  WalletCallRequest,
  WalletCallResult,
} from './types';
import { logger } from '../lib/logger';

const execFileAsync = promisify(execFile);

/**
 * Least-privilege permissions per Circle Agent Wallet.
 * Agents never share wallets. Funds never live in agent wallets —
 * only approved contract calls are submitted.
 */
const permissions: Record<AgentName, readonly ContractPermission[]> = {
  treasury: [
    {
      contract: 'treasury',
      functions: [
        'getTreasuryBalance',
        'getTreasuryAllocationBreakdown',
        'getMembers',
        'getMember',
      ],
    },
  ],
  contribution: [
    {
      contract: 'registry',
      functions: ['getMember', 'getMembers'],
    },
    {
      contract: 'treasury',
      functions: ['getMember', 'getMembers'],
    },
  ],
  rotation: [
    {
      contract: 'rotationManager',
      functions: ['executeRotation', 'getRotationState'],
    },
  ],
  loan: [
    {
      contract: 'loanPool',
      functions: [
        'approveLoan',
        'rejectLoan',
        'getLoan',
        'availableLiquidity',
        'interestEarned',
      ],
    },
  ],
  savings: [
    {
      contract: 'treasury',
      functions: ['getTreasuryBalance', 'getTreasuryAllocationBreakdown'],
    },
  ],
  governance: [
    {
      contract: 'registry',
      functions: [],
    },
  ],
  fraud: [],
  nexa: [],
  notification: [],
};

/** Write functions that may move cooperative state on-chain. */
const MUTATING_FUNCTIONS = new Set([
  'executeRotation',
  'approveLoan',
  'rejectLoan',
]);

/**
 * Circle Agent Wallet adapter.
 * Submits pre-validated calldata only. No private key or seed phrase is ever
 * loaded into the Nexusu process — execution goes through CIRCLE_BIN.
 */
export class CircleAgentWallets {
  wallet(agent: AgentName): AgentWallet | null {
    const address = agentConfig.walletAddress(agent);
    if (!address) return null;
    return {
      agent,
      address,
      allowedContracts: permissions[agent],
    };
  }

  isAllowed(
    agent: AgentName,
    contract: ContractPermission['contract'],
    functionName: string,
  ): boolean {
    const wallet = this.wallet(agent);
    if (!wallet) return false;
    return Boolean(
      wallet.allowedContracts
        .find((p) => p.contract === contract)
        ?.functions.includes(functionName),
    );
  }

  isMutating(functionName: string): boolean {
    return MUTATING_FUNCTIONS.has(functionName);
  }

  async submit(
    agent: AgentName,
    request: WalletCallRequest,
  ): Promise<WalletCallResult> {
    const wallet = this.wallet(agent);
    if (!wallet) {
      throw new Error(`Circle Agent Wallet not configured for ${agent}`);
    }

    if (!this.isAllowed(agent, request.contract, request.functionName)) {
      throw new Error(
        `Policy denied ${agent}.${request.functionName} on ${request.contract}`,
      );
    }

    if (!this.isMutating(request.functionName)) {
      throw new Error(
        `Refusing wallet execute for non-mutating function ${request.functionName}`,
      );
    }

    const circleBin = agentConfig.circleBin;
    if (!circleBin) {
      throw new Error(
        'CIRCLE_BIN is not configured. On Vercel, agent recommend/Nexa work without it; ' +
          'on-chain approve/rotation requires a long-running worker with authenticated Circle CLI ' +
          `(agent wallet ${wallet.address}).`,
      );
    }

    logger.info(
      {
        agent,
        wallet: wallet.address,
        contract: request.contract,
        functionName: request.functionName,
        to: request.to,
        idempotencyKey: request.idempotencyKey,
      },
      'Submitting Circle Agent Wallet transaction',
    );

    const args = [
      'wallet',
      'execute',
      request.signature,
      ...request.args,
      '--contract',
      request.to,
      '--address',
      wallet.address,
      '--chain',
      'ARC-TESTNET',
      '--idempotency-key',
      request.idempotencyKey,
      '--output',
      'json',
    ];

    const { stdout, stderr } = await execFileAsync(circleBin, args, {
      timeout: 120_000,
      maxBuffer: 1_000_000,
      env: process.env,
    });

    if (stderr?.trim()) {
      logger.debug({ agent, stderr: stderr.slice(0, 500) }, 'Circle CLI stderr');
    }

    let body: { data?: { txHash?: string; gasUsed?: string }; txHash?: string };
    try {
      body = JSON.parse(stdout) as typeof body;
    } catch {
      throw new Error('Circle wallet response was not valid JSON');
    }

    const transactionHash = body.data?.txHash ?? body.txHash;
    if (!transactionHash) {
      throw new Error('Circle wallet response did not include a transaction hash');
    }

    return {
      transactionHash,
      gasUsed: body.data?.gasUsed,
    };
  }
}

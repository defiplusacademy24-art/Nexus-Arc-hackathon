/**
 * Minimal ABIs for chain event decoding and read-only tools.
 * Aligns with contracts/src on Arc. Agents never invent function selectors.
 */

export const registryAbi = [
  {
    type: 'event',
    name: 'MemberJoined',
    inputs: [
      { name: 'coopId', type: 'uint256', indexed: true },
      { name: 'member', type: 'address', indexed: true },
      { name: 'joinPosition', type: 'uint32', indexed: false },
      { name: 'displayName', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ContributionUpdated',
    inputs: [
      { name: 'coopId', type: 'uint256', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'frequency', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'getMembers',
    stateMutability: 'view',
    inputs: [{ name: 'coopId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'getMember',
    stateMutability: 'view',
    inputs: [
      { name: 'coopId', type: 'uint256' },
      { name: 'account', type: 'address' },
    ],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'wallet', type: 'address' },
          { name: 'joinPosition', type: 'uint32' },
          { name: 'totalContributed', type: 'uint256' },
          { name: 'active', type: 'bool' },
        ],
      },
    ],
  },
] as const;

export const treasuryAbi = [
  {
    type: 'event',
    name: 'ContributionDeposited',
    inputs: [
      { name: 'member', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'cycle', type: 'uint32', indexed: true },
      { name: 'timestamp', type: 'uint64', indexed: false },
      { name: 'rotationShare', type: 'uint256', indexed: false },
      { name: 'loanShare', type: 'uint256', indexed: false },
      { name: 'emergencyShare', type: 'uint256', indexed: false },
      { name: 'savingsShare', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AllocationUpdated',
    inputs: [
      {
        name: 'allocation',
        type: 'tuple',
        indexed: false,
        components: [
          { name: 'rotationBps', type: 'uint16' },
          { name: 'loanPoolBps', type: 'uint16' },
          { name: 'emergencyBps', type: 'uint16' },
          { name: 'savingsBps', type: 'uint16' },
        ],
      },
    ],
  },
  {
    type: 'event',
    name: 'PayoutExecuted',
    inputs: [
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'cycle', type: 'uint32', indexed: true },
      { name: 'position', type: 'uint32', indexed: false },
      { name: 'timestamp', type: 'uint64', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'getTreasuryBalance',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getTreasuryAllocationBreakdown',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'totalBalance', type: 'uint256' },
          { name: 'rotationFund', type: 'uint256' },
          { name: 'loanPool', type: 'uint256' },
          { name: 'emergencyReserve', type: 'uint256' },
          { name: 'savingsInvestment', type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getMembers',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'getMember',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'wallet', type: 'address' },
          { name: 'joinPosition', type: 'uint32' },
          { name: 'registeredAt', type: 'uint64' },
          { name: 'totalContributed', type: 'uint256' },
          { name: 'active', type: 'bool' },
          { name: 'exists', type: 'bool' },
        ],
      },
    ],
  },
] as const;

export const loanPoolAbi = [
  {
    type: 'event',
    name: 'LoanApplied',
    inputs: [
      { name: 'loanId', type: 'uint256', indexed: true },
      { name: 'borrower', type: 'address', indexed: true },
      { name: 'principal', type: 'uint256', indexed: false },
      { name: 'termMonths', type: 'uint8', indexed: false },
      { name: 'interestBps', type: 'uint16', indexed: false },
      { name: 'totalDue', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'LoanApproved',
    inputs: [
      { name: 'loanId', type: 'uint256', indexed: true },
      { name: 'borrower', type: 'address', indexed: true },
      { name: 'principal', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'LoanRejected',
    inputs: [
      { name: 'loanId', type: 'uint256', indexed: true },
      { name: 'borrower', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'LoanRepaid',
    inputs: [
      { name: 'loanId', type: 'uint256', indexed: true },
      { name: 'borrower', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'principalPortion', type: 'uint256', indexed: false },
      { name: 'interestPortion', type: 'uint256', indexed: false },
      { name: 'remaining', type: 'uint256', indexed: false },
      { name: 'fullyPaid', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'approveLoan',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'loanId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'rejectLoan',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'loanId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getLoan',
    stateMutability: 'view',
    inputs: [{ name: 'loanId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'borrower', type: 'address' },
          { name: 'principal', type: 'uint256' },
          { name: 'interestBps', type: 'uint16' },
          { name: 'totalInterest', type: 'uint256' },
          { name: 'totalDue', type: 'uint256' },
          { name: 'amountPaid', type: 'uint256' },
          { name: 'interestPaid', type: 'uint256' },
          { name: 'termMonths', type: 'uint8' },
          { name: 'requestedAt', type: 'uint64' },
          { name: 'disbursedAt', type: 'uint64' },
          { name: 'dueDate', type: 'uint64' },
          { name: 'status', type: 'uint8' },
          { name: 'purpose', type: 'string' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'availableLiquidity',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'interestEarned',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const rotationManagerAbi = [
  {
    type: 'event',
    name: 'RotationExecuted',
    inputs: [
      { name: 'coopId', type: 'uint256', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'rotationNumber', type: 'uint32', indexed: false },
      { name: 'nextRecipient', type: 'address', indexed: false },
      { name: 'timestamp', type: 'uint64', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CycleCompleted',
    inputs: [
      { name: 'coopId', type: 'uint256', indexed: true },
      { name: 'rotationsCompleted', type: 'uint32', indexed: false },
      { name: 'nextRotationNumber', type: 'uint32', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'executeRotation',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'coopId', type: 'uint256' }],
    outputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'getRotationState',
    stateMutability: 'view',
    inputs: [{ name: 'coopId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'currentRecipient', type: 'address' },
          { name: 'nextRecipient', type: 'address' },
          { name: 'previousRecipient', type: 'address' },
          { name: 'currentRotationNumber', type: 'uint32' },
          { name: 'totalRotationsCompleted', type: 'uint32' },
          { name: 'lastPayoutTimestamp', type: 'uint64' },
          { name: 'nextPayoutTimestamp', type: 'uint64' },
          { name: 'initialized', type: 'bool' },
        ],
      },
    ],
  },
] as const;

export const contractAbis = {
  registry: registryAbi,
  treasury: treasuryAbi,
  loanPool: loanPoolAbi,
  rotationManager: rotationManagerAbi,
} as const;

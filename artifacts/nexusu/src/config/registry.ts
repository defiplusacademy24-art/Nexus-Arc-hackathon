/**
 * CooperativeRegistry + RotationManager — multi-coop orchestration on Arc.
 * Deploy with: contracts/script/DeployRegistry.s.sol
 */

export const COOPERATIVE_REGISTRY_ADDRESS = (import.meta.env
  .VITE_COOPERATIVE_REGISTRY_ADDRESS ?? '') as `0x${string}` | '';

export const ROTATION_MANAGER_ADDRESS = (import.meta.env
  .VITE_ROTATION_MANAGER_ADDRESS ?? '') as `0x${string}` | '';

export function isRegistryConfigured(): boolean {
  return Boolean(
    COOPERATIVE_REGISTRY_ADDRESS &&
      /^0x[a-fA-F0-9]{40}$/.test(COOPERATIVE_REGISTRY_ADDRESS),
  );
}

export function isRotationManagerConfigured(): boolean {
  return Boolean(
    ROTATION_MANAGER_ADDRESS && /^0x[a-fA-F0-9]{40}$/.test(ROTATION_MANAGER_ADDRESS),
  );
}

/** Minimal ABI for registry create / join / views. */
export const cooperativeRegistryAbi = [
  {
    type: 'function',
    name: 'createCooperative',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name_', type: 'string' },
      { name: 'description_', type: 'string' },
      { name: 'treasuryVault_', type: 'address' },
      { name: 'loanPool_', type: 'address' },
      { name: 'contributionAmount_', type: 'uint256' },
      { name: 'frequency_', type: 'uint8' },
      { name: 'maxMembers_', type: 'uint32' },
      { name: 'strategy_', type: 'uint8' },
      { name: 'organizerDisplayName_', type: 'string' },
    ],
    outputs: [{ name: 'coopId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'joinCooperative',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'coopId', type: 'uint256' },
      { name: 'displayName', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'leaveCooperative',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'coopId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getCooperative',
    stateMutability: 'view',
    inputs: [{ name: 'coopId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'name', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'organizer', type: 'address' },
          { name: 'treasuryVault', type: 'address' },
          { name: 'loanPool', type: 'address' },
          { name: 'contributionAmount', type: 'uint256' },
          { name: 'contributionFrequency', type: 'uint8' },
          { name: 'maxMembers', type: 'uint32' },
          { name: 'memberCount', type: 'uint32' },
          { name: 'payoutStrategy', type: 'uint8' },
          { name: 'currentRotationIndex', type: 'uint32' },
          { name: 'status', type: 'uint8' },
          { name: 'createdAt', type: 'uint64' },
          { name: 'exists', type: 'bool' },
        ],
      },
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
    name: 'getMemberPosition',
    stateMutability: 'view',
    inputs: [
      { name: 'coopId', type: 'uint256' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint32' }],
  },
  {
    type: 'function',
    name: 'isMember',
    stateMutability: 'view',
    inputs: [
      { name: 'coopId', type: 'uint256' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getCurrentRecipient',
    stateMutability: 'view',
    inputs: [{ name: 'coopId', type: 'uint256' }],
    outputs: [
      { name: 'recipient', type: 'address' },
      { name: 'position', type: 'uint32' },
    ],
  },
  {
    type: 'function',
    name: 'getNextRecipient',
    stateMutability: 'view',
    inputs: [{ name: 'coopId', type: 'uint256' }],
    outputs: [
      { name: 'recipient', type: 'address' },
      { name: 'position', type: 'uint32' },
    ],
  },
  {
    type: 'function',
    name: 'nextCooperativeId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'rotationManager',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'event',
    name: 'CooperativeCreated',
    inputs: [
      { name: 'coopId', type: 'uint256', indexed: true },
      { name: 'organizer', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'treasuryVault', type: 'address', indexed: false },
      { name: 'loanPool', type: 'address', indexed: false },
      { name: 'contributionAmount', type: 'uint256', indexed: false },
      { name: 'frequency', type: 'uint8', indexed: false },
      { name: 'strategy', type: 'uint8', indexed: false },
    ],
  },
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
] as const;

/** Minimal ABI for rotation execute / views. */
export const rotationManagerAbi = [
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
    name: 'skipRecipient',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'coopId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'manualAdvance',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'coopId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'completeCycle',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'coopId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getCurrentRecipient',
    stateMutability: 'view',
    inputs: [{ name: 'coopId', type: 'uint256' }],
    outputs: [
      { name: 'recipient', type: 'address' },
      { name: 'position', type: 'uint32' },
    ],
  },
  {
    type: 'function',
    name: 'getNextRecipient',
    stateMutability: 'view',
    inputs: [{ name: 'coopId', type: 'uint256' }],
    outputs: [
      { name: 'recipient', type: 'address' },
      { name: 'position', type: 'uint32' },
    ],
  },
  {
    type: 'function',
    name: 'getRotationState',
    stateMutability: 'view',
    inputs: [{ name: 'coopId', type: 'uint256' }],
    outputs: [
      {
        name: '',
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
  {
    type: 'function',
    name: 'canExecute',
    stateMutability: 'view',
    inputs: [{ name: 'coopId', type: 'uint256' }],
    outputs: [
      { name: 'ready', type: 'bool' },
      { name: 'required', type: 'uint32' },
      { name: 'paid', type: 'uint32' },
      { name: 'vault', type: 'address' },
    ],
  },
  {
    type: 'function',
    name: 'registry',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
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
] as const;

/**
 * CooperativeTreasuryVault — on-chain treasury on Arc.
 * Deploy with: contracts/script/Deploy.s.sol
 * Set VITE_TREASURY_VAULT_ADDRESS after deployment.
 */

import { ARC_USDC_ERC20_ADDRESS } from '@/config/arc';

/** Deployed vault (empty until you set env / hardcode after deploy). */
export const TREASURY_VAULT_ADDRESS = (import.meta.env.VITE_TREASURY_VAULT_ADDRESS ??
  '') as `0x${string}` | '';

export const TREASURY_USDC_ADDRESS = ARC_USDC_ERC20_ADDRESS;

/** Minimum contribution the vault accepts ($10 USDC). */
export const MIN_CONTRIBUTION_USDC = 10;

/** ERC-20 approve used before vault.deposit(). */
export const erc20ApproveAbi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/** Minimal ABI for deposit / rules / views / payout (viem / wagmi). */
export const treasuryVaultAbi = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'triggerPayout',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'registerMember',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'member', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setContributionRules',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'frequency', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setContributionAmount',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'organizer',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
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
        name: '',
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
    name: 'getCurrentPayoutRecipient',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'recipient', type: 'address' },
      { name: 'position', type: 'uint32' },
    ],
  },
  {
    type: 'function',
    name: 'getNextPayoutRecipient',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'recipient', type: 'address' },
      { name: 'position', type: 'uint32' },
    ],
  },
  {
    type: 'function',
    name: 'getMemberRotationPosition',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint32' }],
  },
  {
    type: 'function',
    name: 'getContributionStatus',
    stateMutability: 'view',
    inputs: [{ name: 'member', type: 'address' }],
    outputs: [{ name: 'status', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'canTriggerPayout',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'ready', type: 'bool' },
      { name: 'required', type: 'uint32' },
      { name: 'paid', type: 'uint32' },
    ],
  },
  {
    type: 'function',
    name: 'contributionAmount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'requiredContribution',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'contributionFrequency',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'contributionPeriodSeconds',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'nextContributionAt',
    stateMutability: 'view',
    inputs: [{ name: 'member', type: 'address' }],
    outputs: [{ name: '', type: 'uint64' }],
  },
  {
    type: 'function',
    name: 'canDeposit',
    stateMutability: 'view',
    inputs: [{ name: 'member', type: 'address' }],
    outputs: [
      { name: 'ok', type: 'bool' },
      { name: 'reason', type: 'string' },
    ],
  },
  {
    type: 'function',
    name: 'MIN_CONTRIBUTION',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'currentCycle',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint32' }],
  },
  {
    type: 'function',
    name: 'isMember',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
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
    name: 'PayoutExecuted',
    inputs: [
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'cycle', type: 'uint32', indexed: true },
      { name: 'position', type: 'uint32', indexed: false },
      { name: 'timestamp', type: 'uint64', indexed: false },
    ],
  },
] as const;

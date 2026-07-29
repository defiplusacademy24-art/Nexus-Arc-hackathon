/**
 * CooperativeLoanPool — on-chain member lending on Arc.
 * Deploy with: contracts/script/DeployLoan.s.sol
 * Set VITE_LOAN_POOL_ADDRESS after deployment.
 */

import { ARC_USDC_ERC20_ADDRESS } from '@/config/arc';

export const LOAN_POOL_ADDRESS = (import.meta.env.VITE_LOAN_POOL_ADDRESS ??
  '') as `0x${string}` | '';

export const LOAN_POOL_USDC_ADDRESS = ARC_USDC_ERC20_ADDRESS;

/** ERC-20 approve used before fundPool / repay. */
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
] as const;

/** Minimal ABI for apply / approve / repay / views (viem / wagmi). */
export const loanPoolAbi = [
  {
    type: 'function',
    name: 'applyForLoan',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'principal', type: 'uint256' },
      { name: 'termMonths', type: 'uint8' },
      { name: 'purpose', type: 'string' },
    ],
    outputs: [{ name: 'loanId', type: 'uint256' }],
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
    name: 'repay',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'loanId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'fundPool',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'registerBorrower',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'borrower', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setMembershipVault',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'vault', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setProfitRecipient',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'recipient', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'quoteLoan',
    stateMutability: 'view',
    inputs: [
      { name: 'principal', type: 'uint256' },
      { name: 'termMonths', type: 'uint8' },
    ],
    outputs: [
      { name: 'interestBps', type: 'uint16' },
      { name: 'totalInterest', type: 'uint256' },
      { name: 'totalDue', type: 'uint256' },
      { name: 'monthlyPayment', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'getLoan',
    stateMutability: 'view',
    inputs: [{ name: 'loanId', type: 'uint256' }],
    outputs: [
      {
        name: '',
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
    name: 'remainingBalance',
    stateMutability: 'view',
    inputs: [{ name: 'loanId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getBorrowerLoans',
    stateMutability: 'view',
    inputs: [{ name: 'borrower', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    type: 'function',
    name: 'getPoolStats',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'usdcBalance', type: 'uint256' },
      { name: 'liquidity', type: 'uint256' },
      { name: 'outstandingPrincipal', type: 'uint256' },
      { name: 'interestAccrued', type: 'uint256' },
      { name: 'loanCount', type: 'uint256' },
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
    name: 'interestBpsByTerm',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint8' }],
    outputs: [{ name: '', type: 'uint16' }],
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
    name: 'lendingAgent',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'membershipVault',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'isEligibleBorrower',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'canApply',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'ok', type: 'bool' },
      { name: 'reason', type: 'string' },
    ],
  },
  {
    type: 'function',
    name: 'openLoanId',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'nextLoanId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'maxLoanBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint16' }],
  },
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
] as const;

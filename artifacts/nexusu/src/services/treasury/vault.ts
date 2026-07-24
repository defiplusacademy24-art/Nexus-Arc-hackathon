/**
 * On-chain CooperativeTreasuryVault client (Arc Testnet).
 *
 * Reads: public RPC via viem.
 * Writes:
 *  - Circle email/PIN wallets → ucWrite (backend challenge)
 *  - Injected EOA (MetaMask etc.) → eth_sendTransaction via window.ethereum
 */

import {
  createPublicClient,
  encodeFunctionData,
  formatUnits,
  http,
  type Address,
  type Hex,
} from 'viem';
import { arcTestnet } from 'viem/chains';
import {
  ARC_RPC_URL,
  ARC_USDC_ERC20_ADDRESS,
  ARC_TESTNET_CHAIN_ID,
} from '@/config/arc';
import {
  TREASURY_VAULT_ADDRESS,
  TREASURY_USDC_ADDRESS,
  treasuryVaultAbi,
  erc20ApproveAbi,
} from '@/config/treasury-vault';
import {
  loadStoredUcSession,
  ucWrite,
  type UcSession,
} from '@/services/circle/userWallet';
import { ensureArcTestnet, getInjectedProvider } from '@/services/wallet/arc-network';

export type VaultBreakdown = {
  totalBalance: number;
  rotationFund: number;
  loanPool: number;
  emergencyReserve: number;
  savingsInvestment: number;
};

export type VaultSnapshot = {
  configured: boolean;
  vaultAddress: Address | null;
  totalBalance: number;
  contributionAmount: number;
  contributionAmountRaw: bigint;
  currentCycle: number;
  currentRecipient: Address | null;
  currentPosition: number;
  nextRecipient: Address | null;
  nextPosition: number;
  isMember: boolean;
  contributionStatus: 'waiting' | 'paid' | 'exempt' | 'unknown';
  canPayout: boolean;
  paidCount: number;
  requiredCount: number;
  breakdown: VaultBreakdown | null;
  joinPosition: number | null;
};

const STATUS_MAP = ['waiting', 'paid', 'exempt'] as const;

export function isVaultConfigured(): boolean {
  return Boolean(TREASURY_VAULT_ADDRESS && /^0x[a-fA-F0-9]{40}$/.test(TREASURY_VAULT_ADDRESS));
}

export function getVaultAddress(): Address | null {
  if (!isVaultConfigured()) return null;
  return TREASURY_VAULT_ADDRESS as Address;
}

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_RPC_URL),
});

function usdcToNumber(raw: bigint): number {
  return Number(formatUnits(raw, 6));
}

export async function fetchVaultSnapshot(wallet?: string | null): Promise<VaultSnapshot> {
  const vault = getVaultAddress();
  if (!vault) {
    return {
      configured: false,
      vaultAddress: null,
      totalBalance: 0,
      contributionAmount: 0,
      contributionAmountRaw: 0n,
      currentCycle: 0,
      currentRecipient: null,
      currentPosition: 0,
      nextRecipient: null,
      nextPosition: 0,
      isMember: false,
      contributionStatus: 'unknown',
      canPayout: false,
      paidCount: 0,
      requiredCount: 0,
      breakdown: null,
      joinPosition: null,
    };
  }

  const account = wallet && /^0x[a-fA-F0-9]{40}$/i.test(wallet) ? (wallet as Address) : null;

  const [
    balRaw,
    contribRaw,
    cycle,
    currentPair,
    nextPair,
    canPay,
    breakdownRaw,
  ] = await Promise.all([
    publicClient.readContract({
      address: vault,
      abi: treasuryVaultAbi,
      functionName: 'getTreasuryBalance',
    }),
    publicClient.readContract({
      address: vault,
      abi: treasuryVaultAbi,
      functionName: 'contributionAmount',
    }),
    publicClient.readContract({
      address: vault,
      abi: treasuryVaultAbi,
      functionName: 'currentCycle',
    }),
    publicClient.readContract({
      address: vault,
      abi: treasuryVaultAbi,
      functionName: 'getCurrentPayoutRecipient',
    }),
    publicClient.readContract({
      address: vault,
      abi: treasuryVaultAbi,
      functionName: 'getNextPayoutRecipient',
    }),
    publicClient.readContract({
      address: vault,
      abi: treasuryVaultAbi,
      functionName: 'canTriggerPayout',
    }),
    publicClient.readContract({
      address: vault,
      abi: treasuryVaultAbi,
      functionName: 'getTreasuryAllocationBreakdown',
    }),
  ]);

  let isMember = false;
  let contributionStatus: VaultSnapshot['contributionStatus'] = 'unknown';
  let joinPosition: number | null = null;

  if (account) {
    try {
      isMember = Boolean(
        await publicClient.readContract({
          address: vault,
          abi: treasuryVaultAbi,
          functionName: 'isMember',
          args: [account],
        }),
      );
      if (isMember) {
        const status = await publicClient.readContract({
          address: vault,
          abi: treasuryVaultAbi,
          functionName: 'getContributionStatus',
          args: [account],
        });
        const idx = Number(status);
        contributionStatus = STATUS_MAP[idx] ?? 'unknown';
        const pos = await publicClient.readContract({
          address: vault,
          abi: treasuryVaultAbi,
          functionName: 'getMemberRotationPosition',
          args: [account],
        });
        joinPosition = Number(pos);
      }
    } catch {
      /* member views may revert for non-members */
    }
  }

  const [ready, required, paid] = canPay as readonly [boolean, number, number];
  const [curRecipient, curPos] = currentPair as readonly [Address, number];
  const [nxtRecipient, nxtPos] = nextPair as readonly [Address, number];
  const bd = breakdownRaw as {
    totalBalance: bigint;
    rotationFund: bigint;
    loanPool: bigint;
    emergencyReserve: bigint;
    savingsInvestment: bigint;
  };

  return {
    configured: true,
    vaultAddress: vault,
    totalBalance: usdcToNumber(balRaw as bigint),
    contributionAmount: usdcToNumber(contribRaw as bigint),
    contributionAmountRaw: contribRaw as bigint,
    currentCycle: Number(cycle),
    currentRecipient: curRecipient,
    currentPosition: Number(curPos),
    nextRecipient: nxtRecipient && nxtRecipient !== '0x0000000000000000000000000000000000000000'
      ? nxtRecipient
      : null,
    nextPosition: Number(nxtPos),
    isMember,
    contributionStatus,
    canPayout: Boolean(ready),
    paidCount: Number(paid),
    requiredCount: Number(required),
    breakdown: {
      totalBalance: usdcToNumber(bd.totalBalance),
      rotationFund: usdcToNumber(bd.rotationFund),
      loanPool: usdcToNumber(bd.loanPool),
      emergencyReserve: usdcToNumber(bd.emergencyReserve),
      savingsInvestment: usdcToNumber(bd.savingsInvestment),
    },
    joinPosition,
  };
}

async function writeContract(params: {
  contractAddress: Address;
  callData: Hex;
  ucSession?: UcSession | null;
}): Promise<void> {
  const session = params.ucSession ?? loadStoredUcSession();
  if (session) {
    await ucWrite(session, {
      contractAddress: params.contractAddress,
      callData: params.callData,
    });
    return;
  }

  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error(
      'No signing wallet available. Sign in with Circle email or connect an injected wallet on Arc Testnet.',
    );
  }

  await ensureArcTestnet(provider);
  const accounts = (await provider.request({
    method: 'eth_requestAccounts',
  })) as string[];
  const from = accounts[0];
  if (!from) throw new Error('No account selected in the wallet');

  await provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from,
        to: params.contractAddress,
        data: params.callData,
        chainId: `0x${ARC_TESTNET_CHAIN_ID.toString(16)}`,
      },
    ],
  });
}

/**
 * Approve USDC then deposit the fixed contribution amount into the vault.
 */
export async function depositToVault(opts?: {
  ucSession?: UcSession | null;
}): Promise<{ amount: number; txKind: 'circle' | 'injected' }> {
  const vault = getVaultAddress();
  if (!vault) {
    throw new Error(
      'Vault not configured. Deploy the contract and set VITE_TREASURY_VAULT_ADDRESS.',
    );
  }

  const amount = (await publicClient.readContract({
    address: vault,
    abi: treasuryVaultAbi,
    functionName: 'contributionAmount',
  })) as bigint;

  if (amount <= 0n) throw new Error('Vault contribution amount is zero');

  const approveData = encodeFunctionData({
    abi: erc20ApproveAbi,
    functionName: 'approve',
    args: [vault, amount],
  });

  const depositData = encodeFunctionData({
    abi: treasuryVaultAbi,
    functionName: 'deposit',
  });

  const session = opts?.ucSession ?? loadStoredUcSession();
  const usdc = (TREASURY_USDC_ADDRESS || ARC_USDC_ERC20_ADDRESS) as Address;

  await writeContract({
    contractAddress: usdc,
    callData: approveData,
    ucSession: session,
  });

  await writeContract({
    contractAddress: vault,
    callData: depositData,
    ucSession: session,
  });

  return {
    amount: usdcToNumber(amount),
    txKind: session ? 'circle' : 'injected',
  };
}

export async function triggerVaultPayout(opts?: {
  ucSession?: UcSession | null;
}): Promise<void> {
  const vault = getVaultAddress();
  if (!vault) {
    throw new Error(
      'Vault not configured. Deploy the contract and set VITE_TREASURY_VAULT_ADDRESS.',
    );
  }

  const callData = encodeFunctionData({
    abi: treasuryVaultAbi,
    functionName: 'triggerPayout',
  });

  await writeContract({
    contractAddress: vault,
    callData,
    ucSession: opts?.ucSession ?? loadStoredUcSession(),
  });
}

export async function registerMemberOnVault(
  member: Address,
  opts?: { ucSession?: UcSession | null },
): Promise<void> {
  const vault = getVaultAddress();
  if (!vault) {
    throw new Error(
      'Vault not configured. Deploy the contract and set VITE_TREASURY_VAULT_ADDRESS.',
    );
  }

  const callData = encodeFunctionData({
    abi: treasuryVaultAbi,
    functionName: 'registerMember',
    args: [member],
  });

  await writeContract({
    contractAddress: vault,
    callData,
    ucSession: opts?.ucSession ?? loadStoredUcSession(),
  });
}

export { ARC_USDC_ERC20_ADDRESS };

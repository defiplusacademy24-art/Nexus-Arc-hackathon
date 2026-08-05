/**
 * Send ERC-20 USDC from the signed-in Circle (or injected) wallet on Arc Testnet.
 */

import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  http,
  isAddress,
  parseUnits,
  type Address,
  type Hex,
} from 'viem';
import {
  ARC_EXPLORER_URL,
  ARC_RPC_URL,
  ARC_TESTNET_CHAIN_ID,
  ARC_USDC_ERC20_ADDRESS,
  arcTestnet,
} from '@/config/arc';
import { loadStoredUcSession, ucWrite } from '@/services/circle/userWallet';

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_RPC_URL),
});

const transferAbi = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

function getInjectedProvider(): {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
} | null {
  if (typeof window === 'undefined') return null;
  const eth = (window as unknown as { ethereum?: { request: (a: unknown) => Promise<unknown> } })
    .ethereum;
  return eth ?? null;
}

export type TransferUsdcResult = {
  txHash: string | null;
  explorerUrl: string | null;
  amount: number;
  to: string;
};

/**
 * Withdraw / send ERC-20 USDC to another address (6 decimals).
 * Circle email wallets: PIN challenge via contract execution.
 */
export async function transferErc20Usdc(params: {
  from: string;
  to: string;
  /** Human-readable USDC amount, e.g. "12.50" */
  amount: string;
}): Promise<TransferUsdcResult> {
  const from = params.from.trim() as Address;
  const to = params.to.trim() as Address;

  if (!isAddress(from)) throw new Error('Your wallet address is invalid.');
  if (!isAddress(to)) throw new Error('Enter a valid recipient address (0x…).');
  if (from.toLowerCase() === to.toLowerCase()) {
    throw new Error('Recipient cannot be your own wallet.');
  }

  const raw = params.amount.trim().replace(/,/g, '');
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error('Enter a valid amount greater than zero.');
  }
  if (num > 1_000_000_000) {
    throw new Error('Amount is too large.');
  }

  let amountWei: bigint;
  try {
    amountWei = parseUnits(raw, 6);
  } catch {
    throw new Error('Invalid amount format.');
  }
  if (amountWei <= 0n) throw new Error('Amount must be greater than zero.');

  const usdc = ARC_USDC_ERC20_ADDRESS as Address;
  const bal = (await publicClient.readContract({
    address: usdc,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [from],
  })) as bigint;

  if (bal < amountWei) {
    throw new Error(
      `Insufficient USDC. Available ${formatUnits(bal, 6)}, tried to send ${formatUnits(amountWei, 6)}.`,
    );
  }

  const callData = encodeFunctionData({
    abi: transferAbi,
    functionName: 'transfer',
    args: [to, amountWei],
  });

  const session = loadStoredUcSession();
  let txHash: string | null = null;

  if (session?.userToken && session.walletId) {
    const result = await ucWrite(session, {
      contractAddress: usdc,
      callData,
      refId: `withdraw-usdc-${Date.now()}`,
      waitForTx: true,
    });
    txHash = result.txHash;
  } else {
    const provider = getInjectedProvider();
    if (!provider) {
      throw new Error(
        'No signing wallet. Sign in with email (Circle) to withdraw funds.',
      );
    }
    const accounts = (await provider.request({
      method: 'eth_requestAccounts',
    })) as string[];
    const account = accounts[0];
    if (!account) throw new Error('No account selected in the wallet.');

    txHash = (await provider.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: account,
          to: usdc,
          data: callData,
          chainId: `0x${ARC_TESTNET_CHAIN_ID.toString(16)}`,
        },
      ],
    })) as string;

    if (txHash) {
      for (let i = 0; i < 40; i++) {
        const receipt = await publicClient
          .getTransactionReceipt({ hash: txHash as Hex })
          .catch(() => null);
        if (receipt) {
          if (receipt.status === 'reverted') {
            throw new Error(`Transfer reverted on Arc: ${txHash}`);
          }
          break;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  return {
    txHash,
    explorerUrl: txHash ? `${ARC_EXPLORER_URL}/tx/${txHash}` : null,
    amount: num,
    to,
  };
}

export function friendlyTransferError(e: unknown): string {
  if (!(e instanceof Error)) return 'Transfer failed. Please try again.';
  const m = e.message;
  if (/user rejected|denied|cancelled|canceled/i.test(m)) {
    return 'Transfer cancelled.';
  }
  if (/insufficient|not enough/i.test(m)) return m;
  if (/invalid address|valid recipient/i.test(m)) return m;
  if (/rate limit|429/i.test(m)) {
    return 'Network is busy. Wait a moment and try again.';
  }
  return m.length > 180 ? `${m.slice(0, 180)}…` : m;
}

/**
 * Detect Arc Testnet USDC transfers for a wallet via Arcscan (Blockscout) APIs
 * with a viem log-scan fallback.
 */

import {
  createPublicClient,
  formatUnits,
  http,
  parseAbiItem,
  type Address,
  type Log,
} from 'viem';
import {
  ARC_EXPLORER_URL,
  ARC_RPC_URL,
  ARC_USDC_ERC20_ADDRESS,
  arcTestnet,
} from '@/config/arc';

export type DetectedTransfer = {
  txHash: string;
  logIndex: number | null;
  direction: 'in' | 'out';
  amount: number;
  token: 'usdc-erc20' | 'usdc-native';
  counterparty: string;
  blockNumber: number;
  explorerUrl: string;
  timestamp?: string;
};

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_RPC_URL),
});

const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
);

const ARCSCAN_API = 'https://testnet.arcscan.app/api';
const LOOKBACK_BLOCKS = 15_000n;
const CHUNK = 3_000n;
const MIN_NATIVE_VALUE = 0.001; // skip pure gas-only native noise when scanning history

function explorerTx(txHash: string): string {
  return `${ARC_EXPLORER_URL}/tx/${txHash}`;
}

// ── Arcscan (primary) ──────────────────────────────────────────────────────────

type ArcscanTokenTx = {
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenDecimal?: string;
  tokenSymbol?: string;
  contractAddress?: string;
  blockNumber?: string;
  timeStamp?: string;
  logIndex?: string;
  transactionIndex?: string;
};

type ArcscanTx = {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockNumber?: string;
  timeStamp?: string;
  isError?: string;
  txreceipt_status?: string;
};

async function arcscanGet<T>(params: Record<string, string>): Promise<T[]> {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${ARCSCAN_API}?${qs.toString()}`);
  if (!res.ok) throw new Error(`Arcscan HTTP ${res.status}`);
  const data = (await res.json()) as { status?: string; result?: T[] | string; message?: string };
  if (!Array.isArray(data.result)) {
    // "No transactions found" returns status 0
    return [];
  }
  return data.result;
}

export async function scanViaArcscan(wallet: string): Promise<DetectedTransfer[]> {
  const address = wallet.toLowerCase();
  const out: DetectedTransfer[] = [];
  const seen = new Set<string>();

  // ERC-20 USDC transfers
  const tokenTxs = await arcscanGet<ArcscanTokenTx>({
    module: 'account',
    action: 'tokentx',
    address: wallet,
    contractaddress: ARC_USDC_ERC20_ADDRESS,
    page: '1',
    offset: '50',
    sort: 'desc',
  }).catch(() => [] as ArcscanTokenTx[]);

  for (const tx of tokenTxs) {
    const from = (tx.from || '').toLowerCase();
    const to = (tx.to || '').toLowerCase();
    const isIn = to === address;
    const isOut = from === address;
    if (!isIn && !isOut) continue;

    const decimals = Number.parseInt(tx.tokenDecimal || '6', 10) || 6;
    let amount = 0;
    try {
      amount = Number.parseFloat(formatUnits(BigInt(tx.value || '0'), decimals));
    } catch {
      continue;
    }
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const logIndex =
      tx.logIndex != null && tx.logIndex !== ''
        ? Number.parseInt(tx.logIndex, 10)
        : Number.parseInt(tx.transactionIndex || '0', 10) || 0;

    const key = `${tx.hash}:${logIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      txHash: tx.hash,
      logIndex: Number.isFinite(logIndex) ? logIndex : 0,
      direction: isIn ? 'in' : 'out',
      amount,
      token: 'usdc-erc20',
      counterparty: isIn ? from : to,
      blockNumber: Number.parseInt(tx.blockNumber || '0', 10) || 0,
      explorerUrl: explorerTx(tx.hash),
      timestamp: tx.timeStamp
        ? new Date(Number(tx.timeStamp) * 1000).toISOString()
        : undefined,
    });
  }

  // Native USDC value transfers (gas token)
  const nativeTxs = await arcscanGet<ArcscanTx>({
    module: 'account',
    action: 'txlist',
    address: wallet,
    page: '1',
    offset: '50',
    sort: 'desc',
  }).catch(() => [] as ArcscanTx[]);

  for (const tx of nativeTxs) {
    if (tx.isError === '1' || tx.txreceipt_status === '0') continue;
    const from = (tx.from || '').toLowerCase();
    const to = (tx.to || '').toLowerCase();
    const isIn = to === address && from !== address;
    const isOut = from === address && to !== address;
    if (!isIn && !isOut) continue;

    let amount = 0;
    try {
      // Native Arc USDC: explorer may use 18 decimals (wei-style)
      amount = Number.parseFloat(formatUnits(BigInt(tx.value || '0'), 18));
    } catch {
      continue;
    }
    if (!Number.isFinite(amount) || amount < MIN_NATIVE_VALUE) continue;

    const key = `${tx.hash}:native`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      txHash: tx.hash,
      logIndex: null,
      direction: isIn ? 'in' : 'out',
      amount,
      token: 'usdc-native',
      counterparty: isIn ? from : to,
      blockNumber: Number.parseInt(tx.blockNumber || '0', 10) || 0,
      explorerUrl: explorerTx(tx.hash),
      timestamp: tx.timeStamp
        ? new Date(Number(tx.timeStamp) * 1000).toISOString()
        : undefined,
    });
  }

  out.sort((a, b) => b.blockNumber - a.blockNumber);
  return out;
}

// ── RPC log fallback ───────────────────────────────────────────────────────────

function topicAddress(topic: `0x${string}` | undefined): string {
  if (!topic) return '';
  return `0x${topic.slice(-40)}`.toLowerCase();
}

function decodeTransferLog(log: Log, wallet: string): DetectedTransfer | null {
  const walletLc = wallet.toLowerCase();
  const from = topicAddress(log.topics[1] as `0x${string}` | undefined);
  const to = topicAddress(log.topics[2] as `0x${string}` | undefined);
  if (!log.transactionHash) return null;

  const isIn = to === walletLc;
  const isOut = from === walletLc;
  if (!isIn && !isOut) return null;

  let raw = 0n;
  try {
    raw = typeof log.data === 'string' && log.data !== '0x' ? BigInt(log.data) : 0n;
  } catch {
    return null;
  }

  const amount = Number.parseFloat(formatUnits(raw, 6));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return {
    txHash: log.transactionHash,
    logIndex: log.logIndex != null ? Number(log.logIndex) : 0,
    direction: isIn ? 'in' : 'out',
    amount,
    token: 'usdc-erc20',
    counterparty: isIn ? from : to,
    blockNumber: log.blockNumber != null ? Number(log.blockNumber) : 0,
    explorerUrl: explorerTx(log.transactionHash),
  };
}

async function fetchTransferLogs(opts: {
  wallet: Address;
  direction: 'in' | 'out';
  fromBlock: bigint;
  toBlock: bigint;
}): Promise<Log[]> {
  const all: Log[] = [];
  let start = opts.fromBlock;
  while (start <= opts.toBlock) {
    const end =
      start + CHUNK - 1n > opts.toBlock ? opts.toBlock : start + CHUNK - 1n;
    try {
      const logs = await publicClient.getLogs({
        address: ARC_USDC_ERC20_ADDRESS,
        event: TRANSFER_EVENT,
        args:
          opts.direction === 'in'
            ? { to: opts.wallet }
            : { from: opts.wallet },
        fromBlock: start,
        toBlock: end,
      });
      all.push(...(logs as Log[]));
    } catch {
      /* skip chunk */
    }
    start = end + 1n;
  }
  return all;
}

export async function scanErc20UsdcTransfers(
  wallet: string,
  fromBlockHint?: bigint,
): Promise<DetectedTransfer[]> {
  // Prefer Arcscan — faster, covers token + native history
  try {
    const viaExplorer = await scanViaArcscan(wallet);
    if (viaExplorer.length > 0) return viaExplorer;
  } catch (err) {
    console.warn('[onchain] Arcscan scan failed, falling back to RPC logs', err);
  }

  const address = wallet as Address;
  const latest = await publicClient.getBlockNumber();
  const fromBlock =
    fromBlockHint !== undefined && fromBlockHint >= 0n
      ? fromBlockHint
      : latest > LOOKBACK_BLOCKS
        ? latest - LOOKBACK_BLOCKS
        : 0n;

  const [incoming, outgoing] = await Promise.all([
    fetchTransferLogs({ wallet: address, direction: 'in', fromBlock, toBlock: latest }),
    fetchTransferLogs({ wallet: address, direction: 'out', fromBlock, toBlock: latest }),
  ]);

  const seen = new Set<string>();
  const transfers: DetectedTransfer[] = [];
  for (const log of [...incoming, ...outgoing]) {
    const t = decodeTransferLog(log, wallet);
    if (!t) continue;
    const key = `${t.txHash}:${t.logIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    transfers.push(t);
  }
  transfers.sort((a, b) => b.blockNumber - a.blockNumber);
  return transfers;
}

export async function detectNativeUsdcDelta(
  wallet: string,
  previousBalanceWei: bigint | null,
): Promise<{ balanceWei: bigint; transfer: DetectedTransfer | null }> {
  const balanceWei = await publicClient.getBalance({
    address: wallet as Address,
  });

  if (previousBalanceWei === null) {
    return { balanceWei, transfer: null };
  }

  const delta = balanceWei - previousBalanceWei;
  if (delta === 0n) return { balanceWei, transfer: null };

  const amount = Number.parseFloat(
    formatUnits(delta < 0n ? -delta : delta, 18),
  );
  if (!Number.isFinite(amount) || amount < MIN_NATIVE_VALUE) {
    return { balanceWei, transfer: null };
  }

  let blockNumber = 0;
  try {
    const block = await publicClient.getBlock({ blockTag: 'latest' });
    blockNumber = Number(block.number);
  } catch {
    /* ignore */
  }

  return {
    balanceWei,
    transfer: {
      txHash: `native-${wallet.toLowerCase()}-${balanceWei.toString()}-${delta > 0n ? 'in' : 'out'}`,
      logIndex: null,
      direction: delta > 0n ? 'in' : 'out',
      amount,
      token: 'usdc-native',
      counterparty: '',
      blockNumber,
      explorerUrl: `${ARC_EXPLORER_URL}/address/${wallet}`,
    },
  };
}

export async function getLatestBlockNumber(): Promise<bigint> {
  return publicClient.getBlockNumber();
}

export { publicClient as arcPublicClient };

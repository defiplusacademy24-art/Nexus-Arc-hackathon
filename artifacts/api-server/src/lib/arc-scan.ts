/**
 * Scan Arc Testnet for USDC transfers via Arcscan (Blockscout) APIs.
 * Runs server-side to avoid browser CORS.
 */

const ARCSCAN_API = "https://testnet.arcscan.app/api";
const ARC_EXPLORER_URL = "https://testnet.arcscan.app";
const ARC_USDC_ERC20 = "0x3600000000000000000000000000000000000000";

export type DetectedTransfer = {
  txHash: string;
  logIndex: number | null;
  direction: "in" | "out";
  amount: number;
  token: "usdc-erc20" | "usdc-native";
  counterparty: string;
  blockNumber: number;
  explorerUrl: string;
  timestamp?: string;
};

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
  const data = (await res.json()) as {
    status?: string;
    result?: T[] | string;
    message?: string;
  };
  if (!Array.isArray(data.result)) return [];
  return data.result;
}

function formatUnits(value: bigint, decimals: number): number {
  if (decimals <= 0) return Number(value);
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac = value % base;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  const n = fracStr
    ? Number.parseFloat(`${whole}.${fracStr}`)
    : Number(whole);
  return n;
}

function explorerTx(txHash: string): string {
  return `${ARC_EXPLORER_URL}/tx/${txHash}`;
}

/**
 * Fetch recent ERC-20 USDC + native USDC transfers for a wallet from Arcscan.
 */
export async function scanWalletTransfers(
  wallet: string,
): Promise<DetectedTransfer[]> {
  const address = wallet.toLowerCase();
  const out: DetectedTransfer[] = [];
  const seen = new Set<string>();

  const tokenTxs = await arcscanGet<ArcscanTokenTx>({
    module: "account",
    action: "tokentx",
    address: wallet,
    contractaddress: ARC_USDC_ERC20,
    page: "1",
    offset: "50",
    sort: "desc",
  }).catch(() => [] as ArcscanTokenTx[]);

  for (const tx of tokenTxs) {
    const from = (tx.from || "").toLowerCase();
    const to = (tx.to || "").toLowerCase();
    const isIn = to === address;
    const isOut = from === address;
    if (!isIn && !isOut) continue;

    const decimals = Number.parseInt(tx.tokenDecimal || "6", 10) || 6;
    let amount = 0;
    try {
      amount = formatUnits(BigInt(tx.value || "0"), decimals);
    } catch {
      continue;
    }
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const logIndex =
      tx.logIndex != null && tx.logIndex !== ""
        ? Number.parseInt(tx.logIndex, 10)
        : Number.parseInt(tx.transactionIndex || "0", 10) || 0;

    const key = `${tx.hash.toLowerCase()}:${logIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      txHash: tx.hash,
      logIndex: Number.isFinite(logIndex) ? logIndex : 0,
      direction: isIn ? "in" : "out",
      amount,
      token: "usdc-erc20",
      counterparty: isIn ? from : to,
      blockNumber: Number.parseInt(tx.blockNumber || "0", 10) || 0,
      explorerUrl: explorerTx(tx.hash),
      timestamp: tx.timeStamp
        ? new Date(Number(tx.timeStamp) * 1000).toISOString()
        : undefined,
    });
  }

  const nativeTxs = await arcscanGet<ArcscanTx>({
    module: "account",
    action: "txlist",
    address: wallet,
    page: "1",
    offset: "50",
    sort: "desc",
  }).catch(() => [] as ArcscanTx[]);

  for (const tx of nativeTxs) {
    if (tx.isError === "1" || tx.txreceipt_status === "0") continue;
    const from = (tx.from || "").toLowerCase();
    const to = (tx.to || "").toLowerCase();
    const isIn = to === address && from !== address;
    const isOut = from === address && !!to && to !== address;
    if (!isIn && !isOut) continue;

    let amount = 0;
    try {
      amount = formatUnits(BigInt(tx.value || "0"), 18);
    } catch {
      continue;
    }
    // Skip dust / pure gas-looking amounts under 0.001 USDC
    if (!Number.isFinite(amount) || amount < 0.001) continue;

    const key = `${tx.hash.toLowerCase()}:native`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      txHash: tx.hash,
      logIndex: null,
      direction: isIn ? "in" : "out",
      amount,
      token: "usdc-native",
      counterparty: isIn ? from : to,
      blockNumber: Number.parseInt(tx.blockNumber || "0", 10) || 0,
      explorerUrl: explorerTx(tx.hash),
      timestamp: tx.timeStamp
        ? new Date(Number(tx.timeStamp) * 1000).toISOString()
        : undefined,
    });
  }

  out.sort((a, b) => b.blockNumber - a.blockNumber);
  return out;
}

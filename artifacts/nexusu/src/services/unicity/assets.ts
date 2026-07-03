/**
 * Wallet asset service — bridges Sphere SDK RPC responses to Nexusu UI types.
 *
 * The wallet extension exposes balances via:
 *   sphere_getAssets    → Asset[]          (per SDK PaymentsModule.getAssets())
 *   sphere_getFiatBalance → number | null  (total portfolio value in USD)
 *
 * Asset.totalAmount is a decimal string in the coin's SMALLEST unit
 * (like satoshis). We divide by 10^decimals to get the human-readable balance.
 *
 * Never invents data. Gracefully handles missing methods on testnet.
 */

// ── SDK Asset shape (matches @unicitylabs/sphere-sdk PaymentsModule) ──────────
export interface SdkAsset {
  coinId: string;
  symbol: string;
  name: string;
  decimals: number;
  iconUrl?: string;
  totalAmount: string;          // smallest units, e.g. "1000000"
  confirmedAmount: string;      // smallest units
  unconfirmedAmount: string;    // smallest units
  confirmedTokenCount: number;
  unconfirmedTokenCount: number;
  tokenCount: number;
  transferringTokenCount: number;
  transferringAmount: string;   // in-flight, excluded from totalAmount
  priceUsd: number | null;
  priceEur: number | null;
  change24h: number | null;
  fiatValueUsd: number | null;
  fiatValueEur: number | null;
}

// ── Nexusu normalised asset ───────────────────────────────────────────────────
export interface WalletAsset {
  coinId: string;
  symbol: string;
  name: string;
  decimals: number;
  iconUrl?: string;
  /** Human-readable spendable balance string, e.g. "1.23" */
  balance: string;
  /** Human-readable confirmed (settled) balance */
  confirmedBalance: string;
  /** Human-readable unconfirmed (submitted but not yet settled) balance */
  pendingBalance: string | null;
  /** Human-readable in-flight send amount — tokens leaving the wallet, NOT in balance */
  transferringBalance: string | null;
  /** Raw smallest-unit string for accurate math downstream */
  totalAmountRaw: string;
  tokenCount: number;
  priceUsd: number | null;
  change24h: number | null;
  fiatValueUsd: number | null;
}

export interface WalletAssetsResult {
  assets: WalletAsset[];
  /** Sum of all fiatValueUsd across assets (null when prices unavailable) */
  portfolioValueUsd: number | null;
  network: string;
  lastUpdated: Date;
  /** true = SDK responded (even if wallet is empty); false = method unavailable */
  supported: boolean;
}

export const EMPTY_ASSETS: WalletAssetsResult = {
  assets: [],
  portfolioValueUsd: null,
  network: 'testnet2',
  lastUpdated: new Date(),
  supported: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert a smallest-unit decimal string to a human-readable amount.
 * formatUnits("1500000", 6) → "1.5"
 */
export function formatUnits(raw: string, decimals: number): string {
  if (!raw || raw === '0') return '0';
  try {
    const n = BigInt(raw);
    if (n === 0n) return '0';
    if (decimals === 0) return n.toString();
    const divisor = 10n ** BigInt(decimals);
    const whole = n / divisor;
    const frac = n % divisor;
    if (frac === 0n) return whole.toString();
    const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
    return `${whole}.${fracStr}`;
  } catch {
    return '0';
  }
}

/** Normalise a raw SDK Asset into a WalletAsset. */
function normalise(raw: SdkAsset): WalletAsset {
  const { decimals } = raw;
  const balance = formatUnits(raw.totalAmount ?? '0', decimals);
  const confirmedBalance = formatUnits(raw.confirmedAmount ?? '0', decimals);

  const pendingRaw = BigInt(raw.unconfirmedAmount ?? '0');
  const pendingBalance = pendingRaw > 0n ? formatUnits(raw.unconfirmedAmount, decimals) : null;

  const txRaw = BigInt(raw.transferringAmount ?? '0');
  const transferringBalance = txRaw > 0n ? formatUnits(raw.transferringAmount, decimals) : null;

  return {
    coinId: raw.coinId ?? '',
    symbol: raw.symbol ?? '?',
    name: raw.name ?? raw.symbol ?? 'Unknown Asset',
    decimals,
    iconUrl: raw.iconUrl,
    balance,
    confirmedBalance,
    pendingBalance,
    transferringBalance,
    totalAmountRaw: raw.totalAmount ?? '0',
    tokenCount: raw.tokenCount ?? 0,
    priceUsd: raw.priceUsd ?? null,
    change24h: raw.change24h ?? null,
    fiatValueUsd: raw.fiatValueUsd ?? null,
  };
}

// ── Query function type (matches useUnicityWallet.query) ──────────────────────
type QueryFn = <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;

// ── Main fetch ────────────────────────────────────────────────────────────────
export async function fetchWalletAssets(query: QueryFn): Promise<WalletAssetsResult> {
  let rawAssets: SdkAsset[] = [];
  let supported = false;

  // ① Try sphere_getAssets — returns Asset[] directly per SDK PaymentsModule
  try {
    const result = await query<unknown>('sphere_getAssets');

    if (Array.isArray(result)) {
      rawAssets = result as SdkAsset[];
      supported = true;
    } else if (result && typeof result === 'object') {
      // Some wallet implementations wrap in { assets: [...] }
      const wrapped = result as Record<string, unknown>;
      if (Array.isArray(wrapped['assets'])) {
        rawAssets = wrapped['assets'] as SdkAsset[];
        supported = true;
      } else if (Array.isArray(wrapped['data'])) {
        rawAssets = wrapped['data'] as SdkAsset[];
        supported = true;
      }
    }
  } catch (err) {
    const msg = String(err);
    // Only suppress to "not available" when the method is genuinely absent on this network.
    // All other failures (network outage, RPC timeout, etc.) should surface as real errors
    // so the hook can set error state and the UI can display a retry prompt.
    if (/not.support|unknown.method|method.not.found|unrecognized|invalid.method/i.test(msg)) {
      // Method unavailable on this network — clean "not available" state
      return { ...EMPTY_ASSETS, lastUpdated: new Date() };
    }
    // Transient / unexpected error — rethrow so useWalletAssets catches and sets error
    throw err;
  }

  const assets = rawAssets.map(normalise);

  // ② Portfolio total — sum fiatValueUsd if present; else try sphere_getFiatBalance
  let portfolioValueUsd: number | null = null;
  const sumFromAssets = assets.reduce(
    (acc, a) => (a.fiatValueUsd != null ? acc + a.fiatValueUsd : acc),
    0,
  );
  if (assets.some((a) => a.fiatValueUsd != null)) {
    portfolioValueUsd = sumFromAssets;
  } else {
    try {
      const fiat = await query<number | null>('sphere_getFiatBalance');
      if (typeof fiat === 'number') portfolioValueUsd = fiat;
    } catch {
      // Not available — leave null
    }
  }

  return {
    assets,
    portfolioValueUsd,
    network: 'testnet2',
    lastUpdated: new Date(),
    supported,
  };
}

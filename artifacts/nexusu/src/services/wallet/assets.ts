import { formatUnits } from 'viem';
import { ARC_USDC_ERC20_ADDRESS } from '@/config/arc';

/**
 * Official USDC logo from CoinMarketCap CDN (coin id 3408 = USD Coin).
 * @see https://coinmarketcap.com/currencies/usd-coin/
 */
export const USDC_LOGO_URL =
  'https://s2.coinmarketcap.com/static/img/coins/128x128/3408.png';

export interface WalletAsset {
  coinId: string;
  symbol: string;
  name: string;
  decimals: number;
  iconUrl?: string;
  balance: string;
  confirmedBalance: string;
  pendingBalance: string | null;
  transferringBalance: string | null;
  totalAmountRaw: string;
  tokenCount: number;
  priceUsd: number | null;
  change24h: number | null;
  fiatValueUsd: number | null;
  /** Optional secondary note (e.g. gas dual-interface). */
  subtitle?: string;
}

export interface WalletAssetsResult {
  assets: WalletAsset[];
  portfolioValueUsd: number | null;
  network: string;
  lastUpdated: Date;
  supported: boolean;
}

export const EMPTY_ASSETS: WalletAssetsResult = {
  assets: [],
  portfolioValueUsd: null,
  network: 'arc-testnet',
  lastUpdated: new Date(),
  supported: false,
};

export function buildNativeUsdcAsset(balanceWei: bigint): WalletAsset {
  // Arc native gas USDC uses 18 decimals (viem arcTestnet.nativeCurrency).
  const balance = formatUnits(balanceWei, 18);
  return {
    coinId: 'native-usdc',
    symbol: 'USDC',
    name: 'USDC (Gas)',
    decimals: 18,
    iconUrl: USDC_LOGO_URL,
    balance,
    confirmedBalance: balance,
    pendingBalance: null,
    transferringBalance: null,
    totalAmountRaw: balanceWei.toString(),
    tokenCount: 1,
    priceUsd: 1,
    change24h: null,
    fiatValueUsd: Number.parseFloat(balance) || null,
  };
}

export function buildErc20UsdcAsset(balanceRaw: bigint): WalletAsset {
  const balance = formatUnits(balanceRaw, 6);
  return {
    coinId: ARC_USDC_ERC20_ADDRESS,
    symbol: 'USDC',
    name: 'USDC',
    decimals: 6,
    iconUrl: USDC_LOGO_URL,
    balance,
    confirmedBalance: balance,
    pendingBalance: null,
    transferringBalance: null,
    totalAmountRaw: balanceRaw.toString(),
    tokenCount: 1,
    priceUsd: 1,
    change24h: null,
    fiatValueUsd: Number.parseFloat(balance) || null,
  };
}

function amount(a: WalletAsset | null | undefined): number {
  if (!a) return 0;
  const n = Number.parseFloat(a.balance);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Arc exposes the same USDC through two interfaces:
 * - native gas balance (18 decimals via eth_getBalance)
 * - ERC-20 at 0x3600… (6 decimals via balanceOf)
 *
 * Those balances match economically (same dollars). Never sum them.
 * Prefer the ERC-20 line as the single portfolio USDC; only show native
 * separately when it differs meaningfully (rare edge cases).
 */
export function mergeAssets(
  native?: WalletAsset | null,
  erc20?: WalletAsset | null,
): WalletAssetsResult {
  const n = amount(native);
  const e = amount(erc20);
  const hasNative = n > 0;
  const hasErc20 = e > 0;

  // Relative match within 0.5% or absolute dust < 0.01 USDC → same dual balance
  const larger = Math.max(n, e);
  const smaller = Math.min(n, e);
  const sameDualInterface =
    hasNative &&
    hasErc20 &&
    (larger === 0 || (larger - smaller) / larger < 0.005 || larger - smaller < 0.01);

  let assets: WalletAsset[] = [];

  if (sameDualInterface) {
    // Single USDC row — prefer ERC-20 display (6 dp, transfer standard)
    const primary = erc20
      ? {
          ...erc20,
          name: 'USDC',
          subtitle: 'Arc dual interface · includes gas balance',
        }
      : native!;
    // Prefer the slightly higher display if floats differ by dust
    if (erc20 && native && n > e) {
      assets = [
        {
          ...erc20,
          name: 'USDC',
          balance: native.balance,
          confirmedBalance: native.balance,
          fiatValueUsd: n,
          subtitle: 'Arc dual interface · includes gas balance',
        },
      ];
    } else {
      assets = [primary];
    }
  } else if (hasErc20 && hasNative) {
    // Distinct holdings (unusual): show ERC-20 spendable + native gas separately
    assets = [
      { ...erc20!, name: 'USDC' },
      {
        ...native!,
        name: 'USDC Gas Reserve',
        subtitle: 'Native gas only',
      },
    ];
  } else if (hasErc20) {
    assets = [{ ...erc20!, name: 'USDC' }];
  } else if (hasNative) {
    assets = [
      {
        ...native!,
        name: 'USDC',
        subtitle: 'Native gas balance',
      },
    ];
  } else {
    // Zero balances — still return empty-but-supported shape
    assets = [];
  }

  // Portfolio: never double-count dual interface
  let portfolioValueUsd: number | null = null;
  if (sameDualInterface) {
    portfolioValueUsd = larger;
  } else if (assets.length > 0) {
    portfolioValueUsd = assets.reduce((sum, a) => sum + (a.fiatValueUsd ?? 0), 0);
  }

  return {
    assets,
    portfolioValueUsd,
    network: 'arc-testnet',
    lastUpdated: new Date(),
    supported: true,
  };
}

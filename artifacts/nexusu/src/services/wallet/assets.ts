import { formatUnits } from 'viem';
import { ARC_USDC_ERC20_ADDRESS } from '@/config/arc';

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
  const balance = formatUnits(balanceWei, 18);
  return {
    coinId: 'native-usdc',
    symbol: 'USDC',
    name: 'USDC (Native Gas)',
    decimals: 18,
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
    name: 'USDC (ERC-20)',
    decimals: 6,
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

export function mergeAssets(
  native?: WalletAsset | null,
  erc20?: WalletAsset | null,
): WalletAssetsResult {
  const assets = [native, erc20].filter((a): a is WalletAsset => {
    if (!a) return false;
    return Number.parseFloat(a.balance) > 0;
  });

  const portfolioValueUsd = assets.reduce((sum, a) => sum + (a.fiatValueUsd ?? 0), 0);

  return {
    assets: assets.length > 0 ? assets : native ? [native] : erc20 ? [erc20] : [],
    portfolioValueUsd: assets.length > 0 ? portfolioValueUsd : null,
    network: 'arc-testnet',
    lastUpdated: new Date(),
    supported: true,
  };
}
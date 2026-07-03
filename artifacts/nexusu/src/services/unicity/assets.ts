/**
 * Wallet asset service for Nexusu.
 *
 * Attempts to fetch real asset balances from the Sphere SDK via `sphere_getAssets`.
 * Returns a graceful empty state when the method is unavailable or the SDK
 * does not yet expose it on the current network — never invents data.
 */

export interface WalletAsset {
  symbol: string;
  name: string;
  balance: string;
  rawBalance: bigint | null;
  decimals: number;
  estimatedValueUsd: number | null;
  network: string;
  assetId?: string;
}

export interface WalletAssetsResult {
  assets: WalletAsset[];
  network: string;
  lastUpdated: Date;
  supported: boolean;
}

export const EMPTY_ASSETS: WalletAssetsResult = {
  assets: [],
  network: 'testnet2',
  lastUpdated: new Date(),
  supported: false,
};

type QueryFn = <T = unknown>(
  method: string,
  params?: Record<string, unknown>,
) => Promise<T>;

export async function fetchWalletAssets(query: QueryFn): Promise<WalletAssetsResult> {
  try {
    const result = await query<unknown>('sphere_getAssets');

    if (!result || typeof result !== 'object') {
      return { ...EMPTY_ASSETS, supported: false };
    }

    const raw = result as Record<string, unknown>;
    const rawAssets = Array.isArray(raw['assets']) ? raw['assets'] : [];

    const assets: WalletAsset[] = rawAssets.map((a: unknown) => {
      const asset = (a ?? {}) as Record<string, unknown>;
      return {
        symbol: String(asset['symbol'] ?? '?'),
        name: String(asset['name'] ?? asset['symbol'] ?? 'Unknown Asset'),
        balance: String(asset['balance'] ?? '0'),
        rawBalance: null,
        decimals: Number(asset['decimals'] ?? 0),
        estimatedValueUsd: typeof asset['usdValue'] === 'number' ? asset['usdValue'] : null,
        network: String(asset['network'] ?? 'testnet2'),
        assetId: asset['id'] ? String(asset['id']) : undefined,
      };
    });

    return {
      assets,
      network: String(raw['network'] ?? 'testnet2'),
      lastUpdated: new Date(),
      supported: true,
    };
  } catch {
    return { ...EMPTY_ASSETS, lastUpdated: new Date() };
  }
}

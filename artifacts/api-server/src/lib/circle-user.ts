/**
 * Circle user-controlled wallets (email OTP + PIN) for Nexusu.
 *
 * API key stays server-only. The browser uses short-lived userToken /
 * encryptionKey + @circle-fin/w3s-pw-web-sdk for OTP and PIN.
 *
 * Pattern mirrors polaris (bigneb1/polaris) and Circle Programmable Wallets.
 */

import {
  initiateUserControlledWalletsClient,
  type CircleUserControlledWalletsClient,
} from '@circle-fin/user-controlled-wallets';
import { randomUUID } from 'node:crypto';

const API_KEY = process.env['CIRCLE_UC_API_KEY'];
const BLOCKCHAIN = (process.env['CIRCLE_UC_BLOCKCHAIN'] ||
  'ARC-TESTNET') as 'ARC-TESTNET';
const ACCOUNT_TYPE = (process.env['CIRCLE_UC_ACCOUNT_TYPE'] || 'SCA') as
  | 'SCA'
  | 'EOA';

let client: CircleUserControlledWalletsClient | null = null;

export function ucEnabled(): boolean {
  return Boolean(API_KEY);
}

function uc(): CircleUserControlledWalletsClient {
  if (!ucEnabled()) {
    throw new Error('Circle user-controlled wallets not configured');
  }
  if (!client) {
    client = initiateUserControlledWalletsClient({
      apiKey: API_KEY!,
    });
  }
  return client;
}

export async function createSession() {
  const c = uc();
  const userId = `nexusu-${randomUUID()}`;
  await c.createUser({ userId });
  const tok = await c.createUserToken({ userId });
  return {
    userId,
    userToken: tok.data?.userToken,
    encryptionKey: tok.data?.encryptionKey,
  };
}

export async function refreshSession(userId: string) {
  const c = uc();
  const tok = await c.createUserToken({ userId });
  return {
    userId,
    userToken: tok.data?.userToken,
    encryptionKey: tok.data?.encryptionKey,
  };
}

export async function initChallenge(userId: string) {
  const c = uc();
  const res = await c.createUserPinWithWallets({
    userId,
    blockchains: [BLOCKCHAIN],
    accountType: ACCOUNT_TYPE,
  });
  return { challengeId: res.data?.challengeId };
}

export async function getWallet(userId: string) {
  const c = uc();
  const res = await c.listWallets({ userId, blockchain: BLOCKCHAIN });
  const w = res.data?.wallets?.[0];
  if (!w) return null;
  return { walletId: w.id, address: w.address, state: w.state };
}

/** Request an email-OTP device token; Circle emails the one-time code. */
export async function emailDeviceToken(deviceId: string, email: string) {
  const c = uc();
  const res = await c.createDeviceTokenForEmailLogin({ deviceId, email });
  return {
    deviceToken: res.data?.deviceToken,
    deviceEncryptionKey: res.data?.deviceEncryptionKey,
    otpToken: res.data?.otpToken,
  };
}

/** Look up the user's Arc wallet by post-login userToken. */
export async function walletByToken(userToken: string) {
  const c = uc();
  const res = await c.listWallets({ userToken, blockchain: BLOCKCHAIN });
  const w = res.data?.wallets?.[0];
  if (!w) return null;
  return { walletId: w.id, address: w.address, state: w.state };
}

/** Create an Arc wallet for an email-authenticated user (returns challengeId). */
export async function createWalletForToken(userToken: string) {
  const c = uc();
  const res = await c.createWallet({
    userToken,
    blockchains: [BLOCKCHAIN],
    accountType: ACCOUNT_TYPE,
  });
  return { challengeId: res.data?.challengeId };
}

/**
 * First-login: set PIN + create Arc wallet in one ceremony.
 * Required when the user has authenticated via email but has no PIN yet.
 */
export async function pinSetupByToken(userToken: string) {
  const c = uc();
  const res = await c.createUserPinWithWallets({
    userToken,
    blockchains: [BLOCKCHAIN],
    accountType: ACCOUNT_TYPE,
  });
  return { challengeId: res.data?.challengeId };
}

function execPayload(opts: {
  abiFunctionSignature?: string;
  abiParameters?: unknown[];
  callData?: string;
}) {
  // Prefer raw callData when present (always valid hex from viem).
  // abiFunctionSignature path is optional; Circle rejects bad param shapes.
  if (opts.callData && /^0x[0-9a-fA-F]*$/.test(opts.callData) && opts.callData.length >= 10) {
    return { callData: opts.callData as `0x${string}` };
  }
  if (opts.abiFunctionSignature) {
    return {
      abiFunctionSignature: opts.abiFunctionSignature,
      abiParameters: (opts.abiParameters ?? []) as unknown[],
    };
  }
  throw new Error('Contract execution requires callData or abiFunctionSignature');
}

export async function contractExecutionChallengeByToken(
  userToken: string,
  walletId: string,
  contractAddress: string,
  opts: {
    abiFunctionSignature?: string;
    abiParameters?: unknown[];
    callData?: string;
    refId?: string;
  },
) {
  const c = uc();
  // Do NOT pass `blockchain` together with `walletId` — Circle treats them as
  // mutually exclusive and returns "API parameter invalid".
  // The wallet was already created on ARC-TESTNET (see pinSetup / createWallet).
  const res = await c.createUserTransactionContractExecutionChallenge({
    userToken,
    walletId,
    contractAddress,
    ...execPayload(opts),
    ...(opts.refId ? { refId: opts.refId } : {}),
    // HIGH fee reduces stuck QUEUED txs on busy testnets
    fee: { type: 'level', config: { feeLevel: 'HIGH' } },
    idempotencyKey: randomUUID(),
  } as Parameters<
    CircleUserControlledWalletsClient['createUserTransactionContractExecutionChallenge']
  >[0]);
  const challengeId = res.data?.challengeId;
  if (!challengeId) {
    throw new Error('Circle did not return a challengeId for contract execution');
  }
  return { challengeId };
}

export async function contractExecutionChallenge(
  userId: string,
  walletId: string,
  contractAddress: string,
  opts: {
    abiFunctionSignature?: string;
    abiParameters?: unknown[];
    callData?: string;
    refId?: string;
  },
) {
  const c = uc();
  const res = await c.createUserTransactionContractExecutionChallenge({
    userId,
    walletId,
    contractAddress,
    ...execPayload(opts),
    ...(opts.refId ? { refId: opts.refId } : {}),
    fee: { type: 'level', config: { feeLevel: 'HIGH' } },
    idempotencyKey: randomUUID(),
  } as Parameters<
    CircleUserControlledWalletsClient['createUserTransactionContractExecutionChallenge']
  >[0]);
  const challengeId = res.data?.challengeId;
  if (!challengeId) {
    throw new Error('Circle did not return a challengeId for contract execution');
  }
  return { challengeId };
}

/**
 * List recent Circle wallet txs so the client can wait for COMPLETE + txHash.
 */
export async function listUserTransactions(
  userToken: string,
  walletId: string,
  pageSize = 15,
) {
  const c = uc();
  // Try a few shapes — Circle client versions differ on walletIds typing
  let rows: Array<Record<string, unknown>> = [];
  const attempts: unknown[] = [
    { userToken, walletIds: [walletId], pageSize, order: 'DESC' },
    { userToken, walletIds: walletId, pageSize, order: 'DESC' },
    { userToken, pageSize, order: 'DESC' },
  ];
  let lastErr: unknown;
  for (const input of attempts) {
    try {
      const res = await c.listTransactions(
        input as Parameters<CircleUserControlledWalletsClient['listTransactions']>[0],
      );
      rows =
        (res.data as { transactions?: Array<Record<string, unknown>> })?.transactions ??
        [];
      if (rows.length > 0) break;
      // empty list is still a valid response — use it
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr && rows.length === 0) {
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
  return rows.map((t) => ({
    id: String(t.id ?? ''),
    state: String(t.state ?? ''),
    txHash: (t.txHash as string | undefined) ?? null,
    operation: (t.operation as string | undefined) ?? null,
    destinationAddress: (t.destinationAddress as string | undefined) ?? null,
    errorReason:
      (t.errorReason as string | undefined) ||
      (t.errorDetails as string | undefined) ||
      null,
    createDate: String(t.createDate ?? ''),
  }));
}

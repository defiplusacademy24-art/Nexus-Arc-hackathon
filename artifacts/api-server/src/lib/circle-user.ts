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
  if (opts.callData) {
    return { callData: opts.callData as `0x${string}` };
  }
  return {
    abiFunctionSignature: opts.abiFunctionSignature,
    abiParameters: (opts.abiParameters ?? []) as string[],
  };
}

export async function contractExecutionChallengeByToken(
  userToken: string,
  walletId: string,
  contractAddress: string,
  opts: {
    abiFunctionSignature?: string;
    abiParameters?: unknown[];
    callData?: string;
  },
) {
  const c = uc();
  const res = await c.createUserTransactionContractExecutionChallenge({
    userToken,
    walletId,
    contractAddress,
    ...execPayload(opts),
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
    // SDK input is a large conditional union; callData path is validated at runtime by Circle.
  } as Parameters<
    CircleUserControlledWalletsClient['createUserTransactionContractExecutionChallenge']
  >[0]);
  return { challengeId: res.data?.challengeId };
}

export async function contractExecutionChallenge(
  userId: string,
  walletId: string,
  contractAddress: string,
  opts: {
    abiFunctionSignature?: string;
    abiParameters?: unknown[];
    callData?: string;
  },
) {
  const c = uc();
  const res = await c.createUserTransactionContractExecutionChallenge({
    userId,
    walletId,
    contractAddress,
    ...execPayload(opts),
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  } as Parameters<
    CircleUserControlledWalletsClient['createUserTransactionContractExecutionChallenge']
  >[0]);
  return { challengeId: res.data?.challengeId };
}

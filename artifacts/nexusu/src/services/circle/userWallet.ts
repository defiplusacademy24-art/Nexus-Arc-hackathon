/**
 * Circle user-controlled wallets (email OTP + PIN) — client side.
 *
 * Entity secret + API key never touch the browser. This module talks to the
 * Nexusu API (/api/uc/*) for device tokens / challenges, and runs OTP + PIN
 * ceremonies with @circle-fin/w3s-pw-web-sdk (lazy-loaded).
 *
 * Flow (Polaris / lunex-style email login):
 *   getDeviceId → backend emailDeviceToken → verifyOtp UI → onLoginComplete
 *   → list/create Arc wallet (PIN setup on first login)
 */

import type { W3SSdk } from '@circle-fin/w3s-pw-web-sdk';

const ENV = import.meta.env;
const API_URL = (ENV.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';
const APP_ID = (ENV.VITE_CIRCLE_UC_APP_ID as string | undefined) || '';

export function ucWalletEnabled(): boolean {
  return Boolean(APP_ID);
}

export type UcSession = {
  kind: 'uc';
  userToken: string;
  encryptionKey: string;
  walletId: string;
  address: `0x${string}`;
  email?: string;
  userId?: string;
};

const UC_SESSION_KEY = 'nexusu-uc-session';

/** Rehydrate Circle session from localStorage (same key as useCircleEmailWallet). */
export function loadStoredUcSession(): UcSession | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(UC_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as UcSession;
    return s?.kind === 'uc' && s.address && s.walletId ? s : null;
  } catch {
    return null;
  }
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const url = `${API_URL}${path}`;
  const r = await fetch(url, {
    method: body !== undefined ? 'POST' : 'GET',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(
      (data as { error?: string }).error || `Request to ${path} failed (${r.status})`,
    );
  }
  return data as T;
}

function brandLogo(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/logo.png`;
}

function brandSdk(sdk: W3SSdk): void {
  const logo = brandLogo();

  sdk.setThemeColor({
    backdrop: '#030F1F',
    backdropOpacity: 0.65,
    bg: '#FFFFFF',
    divider: '#E2E6EC',
    textMain: '#030F1F',
    textMain2: '#030F1F',
    textAuxiliary: '#56647A',
    textAuxiliary2: '#8E9AAC',
    textSummary: '#030F1F',
    textSummaryHighlight: '#6393C4',
    textPlaceholder: '#8E9AAC',
    textInteractive: '#6393C4',
    textDetailToggle: '#6393C4',
    success: '#0D9464',
    error: '#DC3232',
    pinDotBase: '#FFFFFF',
    pinDotBaseBorder: '#D0D6E0',
    pinDotActivated: '#6393C4',
    enteredPinText: '#030F1F',
    inputText: '#030F1F',
    inputBorderFocused: '#6393C4',
    inputBorderFocusedError: '#DC3232',
    inputBg: '#F6F7F9',
  });

  sdk.setResources({
    securityIntroMain: logo,
    emailIcon: logo,
    dAppIcon: logo,
  });

  sdk.setLocalizations({
    common: {
      continue: 'Continue',
      confirm: 'Confirm',
      sign: 'Approve',
      retry: 'Try again',
    },
    initPincode: {
      headline: 'Secure your Nexusu wallet',
      subhead:
        'Set a 6-digit PIN. It protects your wallet and signs transactions on Arc.',
    },
    confirmInitPincode: {
      headline: 'Confirm your PIN',
      subhead: 'Re-enter your PIN to finish creating your Nexusu wallet.',
    },
    enterPincode: {
      headline: 'Enter your Nexusu PIN',
      subhead: 'Confirm this action with the PIN you set for your wallet.',
    },
  });
}

async function makeSdk(userToken: string, encryptionKey: string): Promise<W3SSdk> {
  const { W3SSdk } = await import('@circle-fin/w3s-pw-web-sdk');
  const sdk = new W3SSdk();
  sdk.setAppSettings({ appId: APP_ID });
  sdk.setAuthentication({ userToken, encryptionKey });
  brandSdk(sdk);
  return sdk;
}

function runChallenge(
  sdk: W3SSdk,
  challengeId: string,
): Promise<{ status?: string }> {
  return new Promise((resolve, reject) => {
    sdk.execute(challengeId, (error, result) => {
      if (error) {
        reject(new Error(error.message || 'Challenge failed'));
        return;
      }
      const status = result && 'status' in result ? String(result.status) : undefined;
      if (status === 'FAILED' || status === 'EXPIRED') {
        reject(new Error(`Wallet challenge ${status.toLowerCase()}. Try again.`));
        return;
      }
      // COMPLETE = user authorized; Circle may still be broadcasting the tx.
      resolve({ status });
    });
  });
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/** Poll Circle for a recent tx hash (SENT / CONFIRMED / COMPLETE). Soft timeout. */
export async function waitForCircleTxHash(
  session: UcSession,
  opts?: { sinceMs?: number; timeoutMs?: number },
): Promise<{ txHash: string | null; lastState: string | null; lastError: string | null }> {
  const timeoutMs = opts?.timeoutMs ?? 45_000;
  const sinceMs = opts?.sinceMs ?? Date.now() - 60_000;
  const started = Date.now();
  let lastState: string | null = null;
  let lastError: string | null = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const data = await api<{
        transactions?: Array<{
          state?: string;
          txHash?: string | null;
          createDate?: string;
          errorReason?: string | null;
        }>;
      }>('/api/uc/transactions', {
        userToken: session.userToken,
        walletId: session.walletId,
      });
      const txs = data.transactions ?? [];
      for (const t of txs) {
        const created = t.createDate ? new Date(t.createDate).getTime() : 0;
        if (created && created < sinceMs - 15_000) continue;
        lastState = t.state ?? lastState;
        if (t.state === 'FAILED' || t.state === 'DENIED' || t.state === 'CANCELLED') {
          lastError = t.errorReason || `Transaction ${t.state}`;
          throw new Error(lastError);
        }
        // Hash can appear as soon as SENT
        if (t.txHash && /SENT|CONFIRMED|COMPLETE|COMPLETED/i.test(String(t.state ?? ''))) {
          return { txHash: t.txHash, lastState: t.state ?? null, lastError: null };
        }
        if (t.txHash) {
          return { txHash: t.txHash, lastState: t.state ?? null, lastError: null };
        }
      }
    } catch (e) {
      if (e instanceof Error && (/Transaction |FAILED|DENIED|CANCELLED/i.test(e.message))) {
        throw e;
      }
      /* keep polling */
    }
    await sleep(3000);
  }
  return { txHash: null, lastState, lastError };
}

async function walletByToken(
  userToken: string,
): Promise<{ walletId: string; address: `0x${string}` } | null> {
  const w = await api<{ walletId?: string; address?: string }>(
    '/api/uc/wallet-by-token',
    { userToken },
  );
  return w.walletId && w.address
    ? { walletId: w.walletId, address: w.address as `0x${string}` }
    : null;
}

/**
 * Email-OTP connect (auth mode enabled in Circle Console).
 * First login: OTP → set PIN → create Arc SCA wallet.
 * Later logins: OTP → restore existing wallet.
 */
export async function connectEmailWallet(email: string): Promise<UcSession> {
  if (!ucWalletEnabled()) {
    throw new Error(
      'Circle email wallet is not configured. Set VITE_CIRCLE_UC_APP_ID.',
    );
  }
  if (!email.trim()) throw new Error('Enter your email');

  const { W3SSdk } = await import('@circle-fin/w3s-pw-web-sdk');

  let resolveLogin!: (r: { userToken: string; encryptionKey: string }) => void;
  let rejectLogin!: (e: Error) => void;
  const loginDone = new Promise<{ userToken: string; encryptionKey: string }>(
    (res, rej) => {
      resolveLogin = res;
      rejectLogin = rej;
    },
  );

  const onLoginComplete = (
    error: { message?: string } | undefined,
    result: { userToken?: string; encryptionKey?: string } | undefined,
  ) => {
    if (error) rejectLogin(new Error(error.message || 'Email login failed'));
    else if (result?.userToken && result.encryptionKey) {
      resolveLogin({
        userToken: result.userToken,
        encryptionKey: result.encryptionKey,
      });
    } else {
      rejectLogin(new Error('Email login returned no session'));
    }
  };

  const sdk = new W3SSdk({ appSettings: { appId: APP_ID } }, onLoginComplete);
  brandSdk(sdk);

  const deviceId = await sdk.getDeviceId();
  const { deviceToken, deviceEncryptionKey, otpToken } = await api<{
    deviceToken: string;
    deviceEncryptionKey: string;
    otpToken: string;
  }>('/api/uc/email-token', { deviceId, email: email.trim() });

  sdk.updateConfigs(
    {
      appSettings: { appId: APP_ID },
      loginConfigs: { deviceToken, deviceEncryptionKey, otpToken },
    },
    onLoginComplete,
  );
  sdk.verifyOtp();

  const { userToken, encryptionKey } = await loginDone;

  let wallet = await walletByToken(userToken);
  if (!wallet) {
    const { challengeId } = await api<{ challengeId: string }>(
      '/api/uc/pin-setup',
      { userToken },
    );
    sdk.setAuthentication({ userToken, encryptionKey });
    await runChallenge(sdk, challengeId);
    for (let i = 0; i < 20 && !wallet; i++) {
      wallet = await walletByToken(userToken);
      if (!wallet) await new Promise((r) => setTimeout(r, 1500));
    }
  }

  if (!wallet) throw new Error('Wallet not ready, please try again');

  return {
    kind: 'uc',
    userToken,
    encryptionKey,
    walletId: wallet.walletId,
    address: wallet.address,
    email: email.trim(),
  };
}

/** Sign a contract write via Circle challenge + PIN (gas sponsored for SCA). */
export async function ucWrite(
  session: UcSession,
  params: {
    contractAddress: `0x${string}`;
    callData?: `0x${string}`;
    abiFunctionSignature?: string;
    abiParameters?: unknown[];
    refId?: string;
    /** Wait for Circle to report COMPLETE + txHash (default true). */
    waitForTx?: boolean;
  },
): Promise<{ txHash: string | null }> {
  const sinceMs = Date.now();
  const body: Record<string, unknown> = {
    userToken: session.userToken,
    userId: session.userId,
    walletId: session.walletId,
    contractAddress: params.contractAddress,
    refId: params.refId,
  };
  if (params.abiFunctionSignature) {
    body.abiFunctionSignature = params.abiFunctionSignature;
    body.abiParameters = params.abiParameters ?? [];
  } else if (params.callData) {
    body.callData = params.callData;
  } else {
    throw new Error('callData or abiFunctionSignature required');
  }

  const { challengeId } = await api<{ challengeId: string }>('/api/uc/execute', body);
  if (!challengeId) {
    throw new Error('Circle did not return a challenge. Check CIRCLE_UC_API_KEY and wallet setup.');
  }
  const sdk = await makeSdk(session.userToken, session.encryptionKey);
  await runChallenge(sdk, challengeId);

  // Soft wait for Circle hash — on-chain verification is the real gate in depositToVault
  if (params.waitForTx === false) {
    return { txHash: null };
  }

  try {
    const { txHash, lastState, lastError } = await waitForCircleTxHash(session, {
      sinceMs,
      timeoutMs: 45_000,
    });
    if (txHash) return { txHash };
    // No hash yet — not fatal; caller should confirm on-chain
    console.warn('[ucWrite] no txHash after PIN', { lastState, lastError });
    return { txHash: null };
  } catch (e) {
    // Explicit Circle FAILED is fatal
    throw e instanceof Error ? e : new Error(String(e));
  }
}

export async function checkUcBackendEnabled(): Promise<boolean> {
  try {
    const r = await api<{ enabled: boolean }>('/api/uc/enabled');
    return Boolean(r.enabled);
  } catch {
    return false;
  }
}

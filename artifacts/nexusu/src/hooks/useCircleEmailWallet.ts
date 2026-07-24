/**
 * Circle email-OTP wallet session state.
 * Sessions are serializable and rehydrate from localStorage across reloads.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  connectEmailWallet,
  ucWalletEnabled,
  type UcSession,
} from '@/services/circle/userWallet';

const UC_SESSION_KEY = 'nexusu-uc-session';
const LAST_UC_EMAIL_KEY = 'nexusu-uc-email';

function loadUcSession(): UcSession | null {
  try {
    const raw = localStorage.getItem(UC_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as UcSession;
    return s?.kind === 'uc' && s.address && s.walletId ? s : null;
  } catch {
    return null;
  }
}

export interface UseCircleEmailWallet {
  uc: UcSession | null;
  circleEmailEnabled: boolean;
  lastUcEmail: string | null;
  isConnectingEmail: boolean;
  emailError: string | null;
  connectWithEmail: (email: string) => Promise<void>;
  disconnectEmail: () => void;
}

export function useCircleEmailWallet(): UseCircleEmailWallet {
  const [uc, setUc] = useState<UcSession | null>(() => loadUcSession());
  const [isConnectingEmail, setIsConnectingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [lastUcEmail, setLastUcEmail] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_UC_EMAIL_KEY);
    } catch {
      return null;
    }
  });

  const connectWithEmail = useCallback(async (email: string) => {
    setIsConnectingEmail(true);
    setEmailError(null);
    try {
      const session = await connectEmailWallet(email);
      setUc(session);
      try {
        localStorage.setItem(LAST_UC_EMAIL_KEY, email.trim());
        localStorage.setItem(UC_SESSION_KEY, JSON.stringify(session));
      } catch {
        /* ignore quota */
      }
      setLastUcEmail(email.trim());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not sign in with email.';
      setEmailError(message);
      throw err;
    } finally {
      setIsConnectingEmail(false);
    }
  }, []);

  const disconnectEmail = useCallback(() => {
    setUc(null);
    setEmailError(null);
    try {
      localStorage.removeItem(UC_SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // Keep identity in sessionStorage for pages that only read stored identity.
  useEffect(() => {
    if (uc?.address) {
      try {
        sessionStorage.setItem(
          'nexusu-arc-wallet-identity',
          JSON.stringify({
            walletAddress: uc.address,
            connectedAt: Date.now(),
          }),
        );
      } catch {
        /* ignore */
      }
    }
  }, [uc]);

  return {
    uc,
    circleEmailEnabled: ucWalletEnabled(),
    lastUcEmail,
    isConnectingEmail,
    emailError,
    connectWithEmail,
    disconnectEmail,
  };
}

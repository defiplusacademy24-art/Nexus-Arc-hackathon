/**
 * useSession — session metadata for the current wallet connection.
 * Derives facts from the session storage, browser APIs, and SDK state.
 */

import { useMemo } from 'react';
import { useUnicity } from '@/providers/UnicityProvider';
import { loadIdentity, loadPopupSessionId } from '@/services/unicity/session';

export interface SessionInfo {
  sessionId: string | null;
  authMethod: 'Extension' | 'Popup' | 'Iframe' | 'Unknown';
  connectedAt: Date | null;
  connectedAtLabel: string;
  deviceLabel: string;
  userAgent: string;
  isSecure: boolean;
  network: string;
}

export function useSession(): SessionInfo | null {
  const { isConnected, session, extensionInstalled } = useUnicity();

  return useMemo(() => {
    if (!isConnected) return null;

    const stored = loadIdentity();
    const sessionId = session ?? loadPopupSessionId();

    let authMethod: SessionInfo['authMethod'] = 'Unknown';
    if (window !== window.parent) {
      authMethod = 'Iframe';
    } else if (extensionInstalled) {
      authMethod = 'Extension';
    } else if (sessionId) {
      authMethod = 'Popup';
    }

    const ua = navigator.userAgent;
    let deviceLabel = 'Desktop Browser';
    if (/iPhone|iPad|iPod/i.test(ua)) deviceLabel = 'iOS Device';
    else if (/Android/i.test(ua)) deviceLabel = 'Android Device';
    else if (/Macintosh/i.test(ua)) deviceLabel = 'Mac';
    else if (/Windows/i.test(ua)) deviceLabel = 'Windows PC';
    else if (/Linux/i.test(ua)) deviceLabel = 'Linux';

    const connectedAt = stored?.connectedAt ? new Date(stored.connectedAt) : null;
    const connectedAtLabel = connectedAt
      ? connectedAt.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : 'This session';

    return {
      sessionId,
      authMethod,
      connectedAt,
      connectedAtLabel,
      deviceLabel,
      userAgent: ua,
      isSecure: location.protocol === 'https:' || location.hostname === 'localhost',
      network: 'testnet2',
    };
  }, [isConnected, session, extensionInstalled]);
}

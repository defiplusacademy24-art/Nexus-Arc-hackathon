/**
 * Mount once under WalletProvider to watch Arc USDC and feed notifications.
 */
import { useOnChainNotifications } from '@/hooks/useOnChainNotifications';

export function OnChainWatcher() {
  useOnChainNotifications();
  return null;
}

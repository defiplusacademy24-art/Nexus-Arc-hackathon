/**
 * Notification categories for the Notifications page.
 *
 * Transactions — on-chain (and money-movement) events users track like a ledger feed.
 * Systems — off-chain platform / cooperative events (create coop, join, AI, governance, …).
 */

import type { AppNotification, NotifType } from '@/types';

export type NotificationCategory = 'transactions' | 'systems';

/** Types that represent value movement (on-chain or treasury ledger). */
const TRANSACTION_TYPES: ReadonlySet<NotifType> = new Set([
  'deposit',
  'withdrawal',
  'contribution',
]);

/**
 * Classify a notification for the Transactions vs Systems UI.
 * Prefer metadata.event when present (onchain.* / tx.* → transactions).
 */
export function getNotificationCategory(
  notif: Pick<AppNotification, 'type' | 'metadata'>,
): NotificationCategory {
  const event =
    notif.metadata && typeof notif.metadata.event === 'string'
      ? notif.metadata.event
      : '';

  if (
    event.startsWith('onchain.') ||
    event.startsWith('tx.') ||
    event === 'contribution' ||
    event.includes('deposit') ||
    event.includes('withdrawal')
  ) {
    return 'transactions';
  }

  if (TRANSACTION_TYPES.has(notif.type)) {
    return 'transactions';
  }

  return 'systems';
}

export function isTransactionNotification(
  notif: Pick<AppNotification, 'type' | 'metadata'>,
): boolean {
  return getNotificationCategory(notif) === 'transactions';
}

export function partitionNotifications(notifs: AppNotification[]): {
  transactions: AppNotification[];
  systems: AppNotification[];
} {
  const transactions: AppNotification[] = [];
  const systems: AppNotification[] = [];
  for (const n of notifs) {
    if (isTransactionNotification(n)) transactions.push(n);
    else systems.push(n);
  }
  return { transactions, systems };
}

/**
 * Unicity Messaging integration — abstraction for secure member communication.
 *
 * Future integration points:
 * - NIP-17 direct messages (Nostr-based) via sphere.messaging
 * - NIP-29 group chat for cooperative channels
 * - Agent-to-member automated notifications
 * - End-to-end encrypted governance discussions
 */

export interface DirectMessage {
  toWallet: string;
  content: string;
  encrypted?: boolean;
}

export interface GroupMessage {
  groupId: string;
  content: string;
}

/** Send a direct message to a member's wallet. Stub. */
export async function sendDirectMessage(_message: DirectMessage): Promise<void> {
  // Future: sphere.messaging.sendDM(toWallet, content)
}

/** Broadcast a message to the cooperative group channel. Stub. */
export async function sendGroupMessage(_message: GroupMessage): Promise<void> {
  // Future: sphere.messaging.sendGroupMessage(groupId, content)
}

/** Subscribe to incoming direct messages. Returns unsubscribe function. */
export function subscribeToMessages(
  _walletAddress: string,
  _onMessage: (msg: DirectMessage) => void,
): () => void {
  // Future: sphere.messaging.subscribeToInbox(onMessage)
  return () => {};
}

/** Create a new cooperative group channel. */
export async function createGroupChannel(_name: string, _members: string[]): Promise<string> {
  // Future: create NIP-29 group on Sphere relay
  return 'stub-group-id';
}

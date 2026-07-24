/**
 * Join / registration validation — pure functions, UI-agnostic.
 */

import type { Cooperative, Member } from '@/types';

export type JoinValidationErrorCode =
  | 'COOP_NOT_FOUND'
  | 'JOINING_CLOSED'
  | 'MAX_MEMBERS'
  | 'DUPLICATE_WALLET'
  | 'DUPLICATE_EMAIL'
  | 'MISSING_WALLET'
  | 'MISSING_EMAIL'
  | 'INVALID_EMAIL'
  | 'MISSING_DISPLAY_NAME';

export class JoinValidationError extends Error {
  readonly code: JoinValidationErrorCode;

  constructor(code: JoinValidationErrorCode, message: string) {
    super(message);
    this.name = 'JoinValidationError';
    this.code = code;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normaliseWallet(wallet: string): string {
  return wallet.trim().toLowerCase();
}

/** Statuses that allow new members to join. */
export function canAcceptJoins(status: string | undefined): boolean {
  if (!status) return true;
  const s = status.toLowerCase();
  // open and draft accept joins; legacy 'pending' treated as open
  return s === 'open' || s === 'draft' || s === 'pending';
}

export function isJoiningClosed(status: string | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === 'active' || s === 'completed' || s === 'inactive';
}

export interface JoinInput {
  walletAddress: string;
  email: string;
  displayName: string;
}

/**
 * Validate a join request against cooperative state and existing members.
 * Throws JoinValidationError on failure.
 */
export function validateJoin(
  coop: Cooperative | null | undefined,
  members: Member[],
  input: JoinInput,
): void {
  if (!coop) {
    throw new JoinValidationError(
      'COOP_NOT_FOUND',
      'Cooperative not found. Check the invite code and try again.',
    );
  }

  if (isJoiningClosed(coop.status)) {
    throw new JoinValidationError(
      'JOINING_CLOSED',
      'Joining is closed. This cooperative is no longer accepting new members.',
    );
  }

  if (!canAcceptJoins(coop.status)) {
    throw new JoinValidationError(
      'JOINING_CLOSED',
      'Joining is closed for this cooperative.',
    );
  }

  if (
    typeof coop.maxMembers === 'number' &&
    coop.maxMembers > 0 &&
    (coop.memberCount ?? members.length) >= coop.maxMembers
  ) {
    throw new JoinValidationError(
      'MAX_MEMBERS',
      'Maximum members has been reached. This cooperative is full.',
    );
  }

  const wallet = (input.walletAddress ?? '').trim();
  if (!wallet) {
    throw new JoinValidationError(
      'MISSING_WALLET',
      'Connect a wallet before joining a cooperative.',
    );
  }

  const email = (input.email ?? '').trim();
  if (!email) {
    throw new JoinValidationError(
      'MISSING_EMAIL',
      'Email is required to register as a member.',
    );
  }
  if (!isValidEmail(email)) {
    throw new JoinValidationError(
      'INVALID_EMAIL',
      'Please enter a valid email address.',
    );
  }

  const displayName = (input.displayName ?? '').trim();
  if (!displayName) {
    throw new JoinValidationError(
      'MISSING_DISPLAY_NAME',
      'Display name is required.',
    );
  }

  const walletKey = normaliseWallet(wallet);
  const emailKey = normaliseEmail(email);

  for (const m of members) {
    if (m.walletIdentity && normaliseWallet(m.walletIdentity) === walletKey) {
      throw new JoinValidationError(
        'DUPLICATE_WALLET',
        'This wallet has already joined this cooperative.',
      );
    }
    if (m.email && normaliseEmail(m.email) === emailKey) {
      throw new JoinValidationError(
        'DUPLICATE_EMAIL',
        'This email has already joined this cooperative.',
      );
    }
  }
}

export function joinErrorMessage(err: unknown): string {
  if (err instanceof JoinValidationError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Could not join cooperative.';
}

/**
 * Unicity Payments integration — abstraction for on-chain payments.
 *
 * Future integration points:
 * - L3 token transfers for contribution collection
 * - Loan disbursements via Unicity asset transfer
 * - Agent-to-agent payment rails
 * - Payment requests with async response tracking
 *
 * Keep all Unicity-specific logic here. Do NOT import from this module in UI components.
 * UI components should call the treasury or savings service, which calls this module.
 */

export interface PaymentRequest {
  recipientWallet: string;
  amount: number;
  coinId: string;
  memo?: string;
  requestId?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  status: 'completed' | 'pending' | 'failed';
  deliveryPending?: boolean;
}

/** Send a payment to a wallet via Unicity L3. Stub — not yet live. */
export async function sendPayment(_request: PaymentRequest): Promise<PaymentResult> {
  // Future: use sphere.payments.send() from @unicitylabs/sphere-sdk
  return { success: true, transactionId: 'stub-txn-id', status: 'completed' };
}

/** Create a payment request for a member contribution. */
export async function createPaymentRequest(_request: PaymentRequest): Promise<string> {
  // Future: use sphere.payments intent API
  return 'stub-request-id';
}

/** Check the status of a payment by its transaction ID. */
export async function getPaymentStatus(_transactionId: string): Promise<PaymentResult> {
  return { success: true, status: 'completed' };
}

/** Get the balance of a wallet address. */
export async function getWalletBalance(_walletAddress: string): Promise<number> {
  // Future: use sphere.payments.getBalance()
  return 0;
}

/** Mint tokens for testnet — for development use only. */
export async function mintTestTokens(_walletAddress: string, _amount: number): Promise<void> {
  // Future: sphere.payments.mintFungibleToken()
}

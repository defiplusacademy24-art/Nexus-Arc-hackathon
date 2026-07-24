/**
 * Resolve the acting wallet from headers or query/body.
 * Frontend sends x-wallet-address from the connected Circle/EVM wallet.
 */

import type { Request } from "express";

export function resolveWallet(req: Request): string | null {
  const header =
    (req.header("x-wallet-address") as string | undefined) ??
    (req.header("X-Wallet-Address") as string | undefined);
  const fromQuery = typeof req.query.wallet === "string" ? req.query.wallet : undefined;
  const body = req.body as { wallet?: string; walletIdentity?: string } | undefined;
  const fromBody = body?.wallet ?? body?.walletIdentity;
  const raw = (header ?? fromQuery ?? fromBody ?? "").trim();
  if (!raw) return null;
  return raw;
}

export function requireWallet(req: Request): string {
  const w = resolveWallet(req);
  if (!w) {
    throw Object.assign(
      new Error("Wallet address required (x-wallet-address header)"),
      { status: 401 },
    );
  }
  return w;
}

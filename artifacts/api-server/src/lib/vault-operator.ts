/**
 * Server-side CooperativeTreasuryVault operator (Arc Testnet).
 *
 * Circle email wallets are different addresses from the forge deploy key.
 * Only the on-chain `organizer` can call registerMember / transferOrganizer.
 * This module uses VAULT_OPERATOR_PRIVATE_KEY (usually the deploy key) so the
 * backend can register a user's Circle wallet and optionally hand them organizer.
 *
 * Testnet / hackathon helper — do not use a mainnet funded key.
 */

import {
  createPublicClient,
  createWalletClient,
  fallback,
  http,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";

const vaultAbi = [
  {
    type: "function",
    name: "organizer",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "isMember",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "registerMember",
    stateMutability: "nonpayable",
    inputs: [{ name: "member", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "transferOrganizer",
    stateMutability: "nonpayable",
    inputs: [{ name: "newOrganizer", type: "address" }],
    outputs: [],
  },
] as const;

function rpcUrls(): string[] {
  const primary =
    process.env.ARC_RPC_URL?.trim() ||
    process.env.VITE_ARC_RPC_URL?.trim() ||
    "https://rpc.testnet.arc.network";
  return [
    primary,
    "https://rpc.testnet.arc.network",
    "https://arc-testnet.drpc.org",
    "https://rpc.drpc.testnet.arc.io",
    "https://5042002.rpc.thirdweb.com",
  ].filter((u, i, a) => Boolean(u) && a.indexOf(u) === i);
}

function vaultAddress(): Address | null {
  const raw =
    process.env.TREASURY_VAULT_ADDRESS?.trim() ||
    process.env.VITE_TREASURY_VAULT_ADDRESS?.trim() ||
    "";
  if (!raw || !isAddress(raw)) return null;
  return raw as Address;
}

function operatorPrivateKey(): Hex | null {
  const raw = process.env.VAULT_OPERATOR_PRIVATE_KEY?.trim() || "";
  if (!raw) return null;
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  return key;
}

export function vaultOperatorConfigured(): boolean {
  return Boolean(vaultAddress() && operatorPrivateKey());
}

export type BootstrapVaultResult = {
  vault: Address;
  member: Address;
  alreadyMember: boolean;
  registered: boolean;
  organizer: Address;
  operator: Address;
  organizerTransferred: boolean;
  registerTxHash: Hex | null;
  transferTxHash: Hex | null;
  message: string;
};

/**
 * Register `member` on the vault (and optionally transfer organizer) using the
 * operator key. Safe to call repeatedly — skips steps already done.
 */
export async function bootstrapVaultMember(params: {
  member: string;
  claimOrganizer?: boolean;
}): Promise<BootstrapVaultResult> {
  const vault = vaultAddress();
  const pk = operatorPrivateKey();
  if (!vault || !pk) {
    throw Object.assign(
      new Error(
        "Vault operator not configured. Set TREASURY_VAULT_ADDRESS and VAULT_OPERATOR_PRIVATE_KEY on the server.",
      ),
      { status: 503 },
    );
  }
  if (!isAddress(params.member)) {
    throw Object.assign(new Error("Invalid wallet address"), { status: 400 });
  }

  const member = params.member as Address;
  const account = privateKeyToAccount(pk);
  const transport = fallback(
    rpcUrls().map((url) =>
      http(url, { timeout: 30_000, retryCount: 3, retryDelay: 1_200 }),
    ),
    { rank: false },
  );

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport,
  });
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport,
  });

  const [organizer, alreadyMember] = await Promise.all([
    publicClient.readContract({
      address: vault,
      abi: vaultAbi,
      functionName: "organizer",
    }),
    publicClient.readContract({
      address: vault,
      abi: vaultAbi,
      functionName: "isMember",
      args: [member],
    }),
  ]);

  let registered = false;
  let registerTxHash: Hex | null = null;
  let organizerTransferred = false;
  let transferTxHash: Hex | null = null;
  let currentOrganizer = organizer as Address;

  const operatorIsOrganizer =
    currentOrganizer.toLowerCase() === account.address.toLowerCase();

  if (!alreadyMember) {
    if (!operatorIsOrganizer) {
      throw Object.assign(
        new Error(
          `Deploy/operator key ${account.address} is no longer the vault organizer (${currentOrganizer}). Ask the current organizer to register you, or re-run bootstrap after restoring organizer.`,
        ),
        { status: 409 },
      );
    }
    registerTxHash = await walletClient.writeContract({
      address: vault,
      abi: vaultAbi,
      functionName: "registerMember",
      args: [member],
      account,
      chain: arcTestnet,
    });
    await publicClient.waitForTransactionReceipt({ hash: registerTxHash });
    registered = true;
  }

  if (params.claimOrganizer) {
    if (currentOrganizer.toLowerCase() === member.toLowerCase()) {
      organizerTransferred = false;
    } else if (!operatorIsOrganizer && !registered) {
      // re-read in case organizer already moved
      throw Object.assign(
        new Error(
          `Cannot transfer organizer: operator key is not the current organizer (${currentOrganizer}).`,
        ),
        { status: 409 },
      );
    } else {
      // After registerMember, operator is still organizer until transfer
      transferTxHash = await walletClient.writeContract({
        address: vault,
        abi: vaultAbi,
        functionName: "transferOrganizer",
        args: [member],
        account,
        chain: arcTestnet,
      });
      await publicClient.waitForTransactionReceipt({ hash: transferTxHash });
      organizerTransferred = true;
      currentOrganizer = member;
    }
  }

  const parts: string[] = [];
  if (alreadyMember && !registered) {
    parts.push("Your Circle wallet was already registered on the vault.");
  } else if (registered) {
    parts.push("Your Circle wallet is now registered on the vault — you can deposit.");
  }
  if (organizerTransferred) {
    parts.push("Organizer role transferred to your Circle wallet.");
  } else if (
    params.claimOrganizer &&
    currentOrganizer.toLowerCase() === member.toLowerCase()
  ) {
    parts.push("Your Circle wallet is already the vault organizer.");
  }

  return {
    vault,
    member,
    alreadyMember: Boolean(alreadyMember),
    registered,
    organizer: currentOrganizer,
    operator: account.address,
    organizerTransferred,
    registerTxHash,
    transferTxHash,
    message: parts.join(" ") || "No changes needed.",
  };
}

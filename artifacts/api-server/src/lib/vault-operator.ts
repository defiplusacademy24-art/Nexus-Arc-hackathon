/**
 * Server-side CooperativeTreasuryVault operator (Arc Testnet).
 *
 * Multi-workspace model:
 *  - Each cooperative has its own vault address (stored on the coop record).
 *  - Factory deploys isolated vaults with the operator as organizer so
 *    registerMember bootstrap still works for Circle wallets.
 *  - Never share one vault across cooperatives (deposit/cycle state leaks).
 *
 * Testnet / hackathon helper — do not use a mainnet funded key.
 */

import {
  createPublicClient,
  createWalletClient,
  fallback,
  http,
  isAddress,
  keccak256,
  stringToHex,
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
  {
    type: "function",
    name: "setLendingPool",
    stateMutability: "nonpayable",
    inputs: [{ name: "pool", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "lendingPool",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "pushLoanAllocationToPool",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "loanPool",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const factoryAbi = [
  {
    type: "function",
    name: "createVault",
    stateMutability: "nonpayable",
    inputs: [
      { name: "organizer_", type: "address" },
      { name: "name_", type: "string" },
      { name: "contributionAmount_", type: "uint256" },
      { name: "frequency_", type: "uint8" },
      { name: "appCoopIdHash_", type: "bytes32" },
    ],
    outputs: [{ name: "vault", type: "address" }],
  },
  {
    type: "function",
    name: "vaultByAppCoopId",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "event",
    name: "VaultCreated",
    inputs: [
      { name: "vault", type: "address", indexed: true },
      { name: "organizer", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "contributionAmount", type: "uint256", indexed: false },
      { name: "frequency", type: "uint8", indexed: false },
      { name: "appCoopIdHash", type: "bytes32", indexed: true },
    ],
  },
] as const;

const ZERO = "0x0000000000000000000000000000000000000000" as Address;

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

/** Legacy single shared vault (do not use for multi-coop). */
function legacyGlobalVaultAddress(): Address | null {
  const raw =
    process.env.TREASURY_VAULT_ADDRESS?.trim() ||
    process.env.VITE_TREASURY_VAULT_ADDRESS?.trim() ||
    "";
  if (!raw || !isAddress(raw)) return null;
  return raw as Address;
}

function factoryAddress(): Address | null {
  const raw =
    process.env.TREASURY_VAULT_FACTORY_ADDRESS?.trim() ||
    process.env.VITE_TREASURY_VAULT_FACTORY_ADDRESS?.trim() ||
    "";
  if (!raw || !isAddress(raw)) return null;
  return raw as Address;
}

function loanPoolFactoryAddress(): Address | null {
  const raw =
    process.env.LOAN_POOL_FACTORY_ADDRESS?.trim() ||
    process.env.VITE_LOAN_POOL_FACTORY_ADDRESS?.trim() ||
    "";
  if (!raw || !isAddress(raw)) return null;
  return raw as Address;
}

const loanPoolFactoryAbi = [
  {
    type: "function",
    name: "createPool",
    stateMutability: "nonpayable",
    inputs: [
      { name: "organizer_", type: "address" },
      { name: "membershipVault_", type: "address" },
      { name: "profitRecipient_", type: "address" },
      { name: "appCoopIdHash_", type: "bytes32" },
    ],
    outputs: [{ name: "pool", type: "address" }],
  },
  {
    type: "function",
    name: "poolByAppCoopId",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "poolByMembershipVault",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "event",
    name: "PoolCreated",
    inputs: [
      { name: "pool", type: "address", indexed: true },
      { name: "organizer", type: "address", indexed: true },
      { name: "membershipVault", type: "address", indexed: true },
      { name: "profitRecipient", type: "address", indexed: false },
      { name: "appCoopIdHash", type: "bytes32", indexed: false },
    ],
  },
] as const;

function operatorPrivateKey(): Hex | null {
  const raw = process.env.VAULT_OPERATOR_PRIVATE_KEY?.trim() || "";
  if (!raw) return null;
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  return key;
}

function makeClients(pk: Hex) {
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
  return { account, publicClient, walletClient };
}

/** True when operator can register members on *some* vault (legacy or factory). */
export function vaultOperatorConfigured(): boolean {
  return Boolean(operatorPrivateKey() && (factoryAddress() || legacyGlobalVaultAddress()));
}

/** True when per-coop vault deployment is available. */
export function vaultFactoryConfigured(): boolean {
  return Boolean(factoryAddress() && operatorPrivateKey());
}

/** True when per-coop loan pool deployment is available. */
export function loanPoolFactoryConfigured(): boolean {
  return Boolean(loanPoolFactoryAddress() && operatorPrivateKey());
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

export type DeployCoopVaultResult = {
  vault: Address;
  factory: Address;
  coopId: string;
  name: string;
  contributionAmountRaw: bigint;
  frequency: number;
  txHash: Hex;
  alreadyExisted: boolean;
  message: string;
};

/**
 * Map app contribution frequency → on-chain enum (0 weekly, 1 bi-weekly, 2 monthly).
 */
export function frequencyToOnChain(freq: string | undefined | null): number {
  switch ((freq ?? "monthly").toLowerCase()) {
    case "weekly":
      return 0;
    case "bi-weekly":
    case "biweekly":
      return 1;
    case "monthly":
    default:
      return 2;
  }
}

/**
 * Deploy an isolated CooperativeTreasuryVault for one cooperative via the factory.
 * Operator is set as on-chain organizer so membership bootstrap still works.
 */
export async function deployCoopVault(params: {
  coopId: string;
  name: string;
  contributionAmountUsd: number;
  contributionFrequency?: string;
}): Promise<DeployCoopVaultResult> {
  const factory = factoryAddress();
  const pk = operatorPrivateKey();
  if (!factory || !pk) {
    throw Object.assign(
      new Error(
        "Vault factory not configured. Set TREASURY_VAULT_FACTORY_ADDRESS and VAULT_OPERATOR_PRIVATE_KEY.",
      ),
      { status: 503 },
    );
  }

  const amountUsd = Number(params.contributionAmountUsd);
  if (!Number.isFinite(amountUsd) || amountUsd < 10) {
    throw Object.assign(
      new Error("contributionAmount must be at least $10 USDC"),
      { status: 400 },
    );
  }

  // USDC 6 decimals
  const contributionAmountRaw = BigInt(Math.round(amountUsd * 1e6));
  const frequency = frequencyToOnChain(params.contributionFrequency);
  const appCoopIdHash = keccak256(stringToHex(params.coopId));
  const { account, publicClient, walletClient } = makeClients(pk);

  // Idempotent: return existing vault if factory already indexed this coop id
  try {
    const existing = (await publicClient.readContract({
      address: factory,
      abi: factoryAbi,
      functionName: "vaultByAppCoopId",
      args: [appCoopIdHash],
    })) as Address;
    if (existing && existing.toLowerCase() !== ZERO.toLowerCase()) {
      return {
        vault: existing,
        factory,
        coopId: params.coopId,
        name: params.name,
        contributionAmountRaw,
        frequency,
        txHash: "0x" as Hex,
        alreadyExisted: true,
        message: "Vault already deployed for this cooperative.",
      };
    }
  } catch {
    /* continue to deploy */
  }

  const txHash = await walletClient.writeContract({
    address: factory,
    abi: factoryAbi,
    functionName: "createVault",
    args: [
      account.address,
      params.name.slice(0, 120) || "Nexusu Cooperative",
      contributionAmountRaw,
      frequency,
      appCoopIdHash,
    ],
    account,
    chain: arcTestnet,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") {
    throw Object.assign(new Error("createVault transaction reverted on Arc"), {
      status: 502,
    });
  }

  // Prefer factory index, then event logs
  let vault: Address | null = null;
  try {
    const indexed = (await publicClient.readContract({
      address: factory,
      abi: factoryAbi,
      functionName: "vaultByAppCoopId",
      args: [appCoopIdHash],
    })) as Address;
    if (indexed && indexed.toLowerCase() !== ZERO.toLowerCase()) {
      vault = indexed;
    }
  } catch {
    /* parse logs */
  }

  if (!vault) {
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== factory.toLowerCase()) continue;
      // topic0 = VaultCreated, topic1 = vault (indexed)
      if (log.topics[1]) {
        vault = `0x${log.topics[1].slice(26)}` as Address;
        break;
      }
    }
  }

  if (!vault || !isAddress(vault)) {
    throw Object.assign(
      new Error("Vault deploy succeeded but address could not be resolved from receipt"),
      { status: 502 },
    );
  }

  return {
    vault,
    factory,
    coopId: params.coopId,
    name: params.name,
    contributionAmountRaw,
    frequency,
    txHash,
    alreadyExisted: false,
    message: `Isolated treasury vault deployed at ${vault}`,
  };
}

export type DeployCoopLoanPoolResult = {
  pool: Address;
  factory: Address;
  vault: Address;
  coopId: string;
  txHash: Hex;
  alreadyExisted: boolean;
  lendingPoolWired: boolean;
  residualPushed: boolean;
  message: string;
};

/**
 * Deploy an isolated CooperativeLoanPool bound to a coop treasury vault,
 * then wire vault.setLendingPool so 30% of deposits auto-fund this pool.
 */
export async function deployCoopLoanPool(params: {
  coopId: string;
  vaultAddress: string;
}): Promise<DeployCoopLoanPoolResult> {
  const factory = loanPoolFactoryAddress();
  const pk = operatorPrivateKey();
  if (!factory || !pk) {
    throw Object.assign(
      new Error(
        "Loan pool factory not configured. Set LOAN_POOL_FACTORY_ADDRESS and VAULT_OPERATOR_PRIVATE_KEY.",
      ),
      { status: 503 },
    );
  }
  if (!isAddress(params.vaultAddress)) {
    throw Object.assign(new Error("Invalid vault address"), { status: 400 });
  }

  const vault = params.vaultAddress as Address;
  const appCoopIdHash = keccak256(stringToHex(params.coopId));
  const { account, publicClient, walletClient } = makeClients(pk);

  let pool: Address | null = null;
  let alreadyExisted = false;
  let txHash: Hex = "0x" as Hex;

  // Idempotent: by app coop id, then by membership vault
  for (const lookup of [
    async () =>
      publicClient.readContract({
        address: factory,
        abi: loanPoolFactoryAbi,
        functionName: "poolByAppCoopId",
        args: [appCoopIdHash],
      }) as Promise<Address>,
    async () =>
      publicClient.readContract({
        address: factory,
        abi: loanPoolFactoryAbi,
        functionName: "poolByMembershipVault",
        args: [vault],
      }) as Promise<Address>,
  ]) {
    try {
      const existing = await lookup();
      if (existing && existing.toLowerCase() !== ZERO.toLowerCase()) {
        pool = existing;
        alreadyExisted = true;
        break;
      }
    } catch {
      /* continue */
    }
  }

  if (!pool) {
    txHash = await walletClient.writeContract({
      address: factory,
      abi: loanPoolFactoryAbi,
      functionName: "createPool",
      args: [account.address, vault, vault, appCoopIdHash],
      account,
      chain: arcTestnet,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === "reverted") {
      throw Object.assign(new Error("createPool transaction reverted on Arc"), {
        status: 502,
      });
    }

    try {
      const indexed = (await publicClient.readContract({
        address: factory,
        abi: loanPoolFactoryAbi,
        functionName: "poolByMembershipVault",
        args: [vault],
      })) as Address;
      if (indexed && indexed.toLowerCase() !== ZERO.toLowerCase()) {
        pool = indexed;
      }
    } catch {
      /* parse logs */
    }

    if (!pool) {
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== factory.toLowerCase()) continue;
        if (log.topics[1]) {
          pool = `0x${log.topics[1].slice(26)}` as Address;
          break;
        }
      }
    }
  }

  if (!pool || !isAddress(pool)) {
    throw Object.assign(
      new Error("Loan pool deploy succeeded but address could not be resolved"),
      { status: 502 },
    );
  }

  // Wire 30% auto-forward: vault.lendingPool = this pool
  let lendingPoolWired = false;
  try {
    const current = (await publicClient.readContract({
      address: vault,
      abi: vaultAbi,
      functionName: "lendingPool",
    })) as Address;
    if (!current || current.toLowerCase() !== pool.toLowerCase()) {
      const wireTx = await walletClient.writeContract({
        address: vault,
        abi: vaultAbi,
        functionName: "setLendingPool",
        args: [pool],
        account,
        chain: arcTestnet,
      });
      await publicClient.waitForTransactionReceipt({ hash: wireTx });
      lendingPoolWired = true;
    } else {
      lendingPoolWired = true;
    }
  } catch (e) {
    // Operator may not be vault organizer on legacy vaults
    console.warn("[vault-operator] setLendingPool failed:", e);
  }

  // Push residual vault loan-share USDC into the pool if any
  let residualPushed = false;
  try {
    const residual = (await publicClient.readContract({
      address: vault,
      abi: vaultAbi,
      functionName: "loanPool",
    })) as bigint;
    if (residual > 0n) {
      const pushTx = await walletClient.writeContract({
        address: vault,
        abi: vaultAbi,
        functionName: "pushLoanAllocationToPool",
        account,
        chain: arcTestnet,
      });
      await publicClient.waitForTransactionReceipt({ hash: pushTx });
      residualPushed = true;
    }
  } catch {
    /* none or not organizer */
  }

  return {
    pool,
    factory,
    vault,
    coopId: params.coopId,
    txHash,
    alreadyExisted,
    lendingPoolWired,
    residualPushed,
    message: alreadyExisted
      ? `Loan pool already exists at ${pool}${lendingPoolWired ? " (30% auto-fund wired)" : ""}`
      : `Isolated loan pool deployed at ${pool}${lendingPoolWired ? "; 30% of deposits auto-fund this pool" : ""}`,
  };
}

/**
 * Deploy vault + loan pool for a cooperative and wire 30% auto-funding.
 * Idempotent when factories already indexed the coop id.
 */
export async function provisionCoopOnchainInfrastructure(params: {
  coopId: string;
  name: string;
  contributionAmountUsd: number;
  contributionFrequency?: string;
  /** Skip vault deploy if already known. */
  existingVaultAddress?: string | null;
  /** Skip pool deploy if already known. */
  existingLoanPoolAddress?: string | null;
}): Promise<{
  vault: Address;
  loanPool: Address | null;
  vaultDeploy: DeployCoopVaultResult | null;
  poolDeploy: DeployCoopLoanPoolResult | null;
  message: string;
}> {
  let vault: Address;
  let vaultDeploy: DeployCoopVaultResult | null = null;

  if (params.existingVaultAddress && isAddress(params.existingVaultAddress)) {
    vault = params.existingVaultAddress as Address;
  } else {
    if (!vaultFactoryConfigured()) {
      throw Object.assign(
        new Error(
          "Vault factory not configured. Set TREASURY_VAULT_FACTORY_ADDRESS and VAULT_OPERATOR_PRIVATE_KEY.",
        ),
        { status: 503 },
      );
    }
    vaultDeploy = await deployCoopVault({
      coopId: params.coopId,
      name: params.name,
      contributionAmountUsd: params.contributionAmountUsd,
      contributionFrequency: params.contributionFrequency,
    });
    vault = vaultDeploy.vault;
  }

  let loanPool: Address | null = null;
  let poolDeploy: DeployCoopLoanPoolResult | null = null;

  if (params.existingLoanPoolAddress && isAddress(params.existingLoanPoolAddress)) {
    loanPool = params.existingLoanPoolAddress as Address;
    // Still try to wire 30% if pool factory path available
    if (loanPoolFactoryConfigured()) {
      try {
        poolDeploy = await deployCoopLoanPool({
          coopId: params.coopId,
          vaultAddress: vault,
        });
        loanPool = poolDeploy.pool;
      } catch {
        /* keep existing */
      }
    }
  } else if (loanPoolFactoryConfigured()) {
    poolDeploy = await deployCoopLoanPool({
      coopId: params.coopId,
      vaultAddress: vault,
    });
    loanPool = poolDeploy.pool;
  }

  const parts = [
    vaultDeploy?.message,
    poolDeploy?.message,
    !poolDeploy && loanPool ? `Loan pool: ${loanPool}` : null,
    !loanPoolFactoryConfigured()
      ? "Loan pool factory not set — only vault provisioned; set LOAN_POOL_FACTORY_ADDRESS for isolated 30% lending."
      : null,
  ].filter(Boolean);

  return {
    vault,
    loanPool,
    vaultDeploy,
    poolDeploy,
    message: parts.join(" ") || "On-chain infrastructure ready.",
  };
}

/**
 * Register `member` on a specific vault (preferred) or the legacy global vault.
 * Safe to call repeatedly — skips steps already done.
 */
export async function bootstrapVaultMember(params: {
  member: string;
  /** Per-cooperative vault — required for multi-workspace isolation. */
  vaultAddress?: string | null;
  claimOrganizer?: boolean;
}): Promise<BootstrapVaultResult> {
  const vaultRaw = params.vaultAddress?.trim() || legacyGlobalVaultAddress();
  const pk = operatorPrivateKey();
  if (!vaultRaw || !isAddress(vaultRaw) || !pk) {
    throw Object.assign(
      new Error(
        "Vault operator not configured. Provide the cooperative treasuryVaultAddress (or legacy TREASURY_VAULT_ADDRESS) and VAULT_OPERATOR_PRIVATE_KEY.",
      ),
      { status: 503 },
    );
  }
  if (!isAddress(params.member)) {
    throw Object.assign(new Error("Invalid wallet address"), { status: 400 });
  }

  const vault = vaultRaw as Address;
  const member = params.member as Address;
  const { account, publicClient, walletClient } = makeClients(pk);

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
          `Deploy/operator key ${account.address} is no longer the vault organizer (${currentOrganizer}). Members can still self-join via joinVault/deposit on this vault.`,
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
      throw Object.assign(
        new Error(
          `Cannot transfer organizer: operator key is not the current organizer (${currentOrganizer}).`,
        ),
        { status: 409 },
      );
    } else {
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

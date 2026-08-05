/** Shared domain types for file + Postgres stores. */

export type NotifType =
  | "contribution"
  | "deposit"
  | "withdrawal"
  | "loan"
  | "proposal"
  | "vote"
  | "member"
  | "ai"
  | "treasury"
  | "warning";

export interface StoredNotification {
  id: string;
  recipientWallet: string;
  coopId: string | null;
  type: NotifType;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  actionLabel?: string;
  actionHref?: string;
  metadata?: Record<string, unknown>;
}

export type RotationMode =
  | "JOIN_ORDER"
  | "RANDOM"
  | "ORGANIZER_ASSIGNED"
  | "GOVERNANCE_VOTE";

export const DEFAULT_ROTATION_MODE: RotationMode = "JOIN_ORDER";

export type CoopLifecycleStatus = "draft" | "open" | "active" | "completed";

export type ContributionStatus =
  | "waiting"
  | "pending"
  | "paid"
  | "overdue"
  | "exempt";

export interface StoredCooperative {
  id: string;
  name: string;
  description: string;
  type: string;
  country: string;
  currency: string;
  memberCount: number;
  treasuryBalance: number;
  contributionAmount: number;
  contributionFrequency: string;
  walletIdentity: string;
  status: string;
  inviteCode: string;
  founderWalletIdentity: string;
  privacy?: string;
  votingModel?: string;
  approvalThreshold?: number;
  loanApprovalPolicy?: string;
  aiGovernanceEnabled?: boolean;
  maxMembers?: number;
  rotationMode?: RotationMode;
  currentRecipientPosition?: number;
  currentCycle?: number;
  /**
   * Isolated CooperativeTreasuryVault address for this workspace.
   * Required for multi-coop deposits — never share one vault across coops.
   */
  treasuryVaultAddress?: string | null;
  /**
   * Isolated CooperativeLoanPool for this workspace (30% of vault deposits).
   * Never share one pool across cooperatives.
   */
  loanPoolAddress?: string | null;
  createdAt: string;
}

export interface StoredMember {
  id: string;
  coopId: string;
  walletIdentity: string;
  name: string;
  displayName?: string;
  email?: string;
  role: string;
  status: string;
  joinedAt: string;
  totalContributed: number;
  joinPosition?: number;
  contributionStatus?: ContributionStatus;
  hasReceivedPayout?: boolean;
  creditScore?: number;
}

export type TxType = "deposit" | "withdrawal" | "contribution";

export interface StoredTransaction {
  id: string;
  coopId: string;
  walletIdentity: string;
  type: TxType;
  amount: number;
  currency: string;
  note?: string;
  createdAt: string;
}

export interface StoredOnchainTransfer {
  id: string;
  key: string;
  txHash: string;
  logIndex: number | null;
  wallet: string;
  direction: "in" | "out";
  amount: number;
  token: "usdc-erc20" | "usdc-native";
  counterparty: string;
  blockNumber: number;
  explorerUrl?: string;
  createdAt: string;
}

export type CreateNotificationInput = {
  recipientWallet: string;
  coopId?: string | null;
  type: NotifType;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  metadata?: Record<string, unknown>;
};

export type CreateCoopInput = {
  name: string;
  description?: string;
  type?: string;
  country?: string;
  currency?: string;
  contributionAmount?: number;
  contributionFrequency?: string;
  privacy?: string;
  votingModel?: string;
  approvalThreshold?: number;
  loanApprovalPolicy?: string;
  aiGovernanceEnabled?: boolean;
  maxMembers?: number;
  inviteCode?: string;
  rotationMode?: string;
  status?: string;
  founderDisplayName?: string;
  founderEmail?: string;
};

export type JoinCoopInput = {
  inviteCode: string;
  wallet: string;
  displayName?: string;
  email?: string;
};

export type IngestOnchainInput = {
  txHash: string;
  logIndex?: number | null;
  wallet: string;
  direction: "in" | "out";
  amount: number;
  token?: "usdc-erc20" | "usdc-native";
  counterparty?: string;
  blockNumber?: number;
  explorerUrl?: string;
  timestamp?: string;
};

/** Hosted autonomous agents (treasury, lending, governance, etc.). */
export type AgentStatus = "running" | "stopped" | "provisioning";

export interface StoredAgent {
  id: string;
  name: string;
  type: string;
  status: AgentStatus;
  coopId?: string | null;
  createdAt: string;
}

/** Public landing-page metrics (no auth). */
export interface PlatformStats {
  cooperatives: number;
  activeCooperatives: number;
  members: number;
  agentsRunning: number;
  agentsTotal: number;
  transactions: number;
  storage: "postgres" | "file";
  updatedAt: string;
}

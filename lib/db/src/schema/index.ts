/**
 * Nexusu domain tables — cooperatives, members, transactions, notifications.
 * Source of truth when DATABASE_URL is set (Vercel Postgres / Neon / any Postgres).
 */

import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const cooperativesTable = pgTable(
  "cooperatives",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    type: text("type").notNull().default("General"),
    country: text("country").notNull().default(""),
    currency: text("currency").notNull().default("USD"),
    memberCount: integer("member_count").notNull().default(1),
    treasuryBalance: doublePrecision("treasury_balance").notNull().default(0),
    contributionAmount: doublePrecision("contribution_amount").notNull().default(0),
    contributionFrequency: text("contribution_frequency").notNull().default("monthly"),
    walletIdentity: text("wallet_identity").notNull(),
    status: text("status").notNull().default("open"),
    inviteCode: text("invite_code").notNull(),
    founderWalletIdentity: text("founder_wallet_identity").notNull(),
    privacy: text("privacy"),
    votingModel: text("voting_model"),
    approvalThreshold: integer("approval_threshold"),
    loanApprovalPolicy: text("loan_approval_policy"),
    aiGovernanceEnabled: boolean("ai_governance_enabled"),
    maxMembers: integer("max_members"),
    rotationMode: text("rotation_mode"),
    currentRecipientPosition: integer("current_recipient_position"),
    currentCycle: integer("current_cycle"),
    /** Isolated on-chain CooperativeTreasuryVault address for this workspace. */
    treasuryVaultAddress: text("treasury_vault_address"),
    /** Isolated CooperativeLoanPool address (30% of vault deposits). */
    loanPoolAddress: text("loan_pool_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("cooperatives_invite_code_uidx").on(t.inviteCode),
    index("cooperatives_founder_idx").on(t.founderWalletIdentity),
  ],
);

export const membersTable = pgTable(
  "members",
  {
    id: text("id").primaryKey(),
    coopId: text("coop_id")
      .notNull()
      .references(() => cooperativesTable.id, { onDelete: "cascade" }),
    walletIdentity: text("wallet_identity").notNull(),
    name: text("name").notNull(),
    displayName: text("display_name"),
    email: text("email"),
    role: text("role").notNull().default("member"),
    status: text("status").notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    totalContributed: doublePrecision("total_contributed").notNull().default(0),
    joinPosition: integer("join_position"),
    contributionStatus: text("contribution_status"),
    hasReceivedPayout: boolean("has_received_payout"),
    creditScore: integer("credit_score"),
  },
  (t) => [
    uniqueIndex("members_coop_wallet_uidx").on(t.coopId, t.walletIdentity),
    index("members_wallet_idx").on(t.walletIdentity),
    index("members_coop_idx").on(t.coopId),
  ],
);

export const transactionsTable = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    coopId: text("coop_id")
      .notNull()
      .references(() => cooperativesTable.id, { onDelete: "cascade" }),
    walletIdentity: text("wallet_identity").notNull(),
    type: text("type").notNull(),
    amount: doublePrecision("amount").notNull(),
    currency: text("currency").notNull().default("USD"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("transactions_coop_idx").on(t.coopId),
    index("transactions_wallet_idx").on(t.walletIdentity),
  ],
);

export const notificationsTable = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    recipientWallet: text("recipient_wallet").notNull(),
    coopId: text("coop_id"),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
    read: boolean("read").notNull().default(false),
    actionLabel: text("action_label"),
    actionHref: text("action_href"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (t) => [
    index("notifications_recipient_idx").on(t.recipientWallet),
    index("notifications_coop_idx").on(t.coopId),
  ],
);

export const onchainTransfersTable = pgTable(
  "onchain_transfers",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    txHash: text("tx_hash").notNull(),
    logIndex: integer("log_index"),
    wallet: text("wallet").notNull(),
    direction: text("direction").notNull(),
    amount: doublePrecision("amount").notNull(),
    token: text("token").notNull().default("usdc-erc20"),
    counterparty: text("counterparty").notNull().default(""),
    blockNumber: integer("block_number").notNull().default(0),
    explorerUrl: text("explorer_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("onchain_transfers_key_uidx").on(t.key),
    index("onchain_transfers_wallet_idx").on(t.wallet),
  ],
);

/**
 * Hosted autonomous agents (treasury, lending, governance, risk, etc.).
 * Empty until agent hosting is provisioned; landing page counts status=running.
 */
export const agentsTable = pgTable(
  "platform_agents",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull().default("running"),
    coopId: text("coop_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("platform_agents_status_idx").on(t.status),
    index("platform_agents_coop_idx").on(t.coopId),
  ],
);

export type CooperativeRow = typeof cooperativesTable.$inferSelect;
export type MemberRow = typeof membersTable.$inferSelect;
export type TransactionRow = typeof transactionsTable.$inferSelect;
export type NotificationRow = typeof notificationsTable.$inferSelect;
export type OnchainTransferRow = typeof onchainTransfersTable.$inferSelect;
export type AgentRow = typeof agentsTable.$inferSelect;

/**
 * Postgres client for Nexusu domain data.
 * Lazy init — only connects when DATABASE_URL is set and getDb() is called.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export type Db = ReturnType<typeof drizzle<typeof schema>>;

let pool: pg.Pool | null = null;
let db: Db | null = null;
let schemaReady: Promise<void> | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getPool(): pg.Pool {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL must be set. Provision Postgres (Vercel Postgres / Neon) and set the env var.",
    );
  }
  if (!pool) {
    const serverless = Boolean(
      process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
    );
    pool = new Pool({
      connectionString: url,
      // Serverless: small pool, short idle so connections release quickly
      max: serverless ? 1 : 10,
      idleTimeoutMillis: serverless ? 5_000 : 30_000,
      connectionTimeoutMillis: 10_000,
      ssl:
        url.includes("localhost") || url.includes("127.0.0.1")
          ? undefined
          : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export function getDb(): Db {
  if (!db) {
    db = drizzle(getPool(), { schema });
  }
  return db;
}

/**
 * Create tables if missing (idempotent). Safe to call on cold start.
 * Prefer `pnpm --filter @workspace/db run push` in CI for managed schema.
 */
export async function ensureSchema(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  if (!schemaReady) {
    schemaReady = (async () => {
      const p = getPool();
      await p.query(`
CREATE TABLE IF NOT EXISTS cooperatives (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'General',
  country TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'USD',
  member_count INTEGER NOT NULL DEFAULT 1,
  treasury_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
  contribution_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  contribution_frequency TEXT NOT NULL DEFAULT 'monthly',
  wallet_identity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  invite_code TEXT NOT NULL,
  founder_wallet_identity TEXT NOT NULL,
  privacy TEXT,
  voting_model TEXT,
  approval_threshold INTEGER,
  loan_approval_policy TEXT,
  ai_governance_enabled BOOLEAN,
  max_members INTEGER,
  rotation_mode TEXT,
  current_recipient_position INTEGER,
  current_cycle INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS cooperatives_invite_code_uidx ON cooperatives (invite_code);
CREATE INDEX IF NOT EXISTS cooperatives_founder_idx ON cooperatives (founder_wallet_identity);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  coop_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
  wallet_identity TEXT NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_contributed DOUBLE PRECISION NOT NULL DEFAULT 0,
  join_position INTEGER,
  contribution_status TEXT,
  has_received_payout BOOLEAN,
  credit_score INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS members_coop_wallet_uidx ON members (coop_id, wallet_identity);
CREATE INDEX IF NOT EXISTS members_wallet_idx ON members (wallet_identity);
CREATE INDEX IF NOT EXISTS members_coop_idx ON members (coop_id);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  coop_id TEXT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
  wallet_identity TEXT NOT NULL,
  type TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS transactions_coop_idx ON transactions (coop_id);
CREATE INDEX IF NOT EXISTS transactions_wallet_idx ON transactions (wallet_identity);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  recipient_wallet TEXT NOT NULL,
  coop_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  action_label TEXT,
  action_href TEXT,
  metadata JSONB
);
CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON notifications (recipient_wallet);
CREATE INDEX IF NOT EXISTS notifications_coop_idx ON notifications (coop_id);

CREATE TABLE IF NOT EXISTS onchain_transfers (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER,
  wallet TEXT NOT NULL,
  direction TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  token TEXT NOT NULL DEFAULT 'usdc-erc20',
  counterparty TEXT NOT NULL DEFAULT '',
  block_number INTEGER NOT NULL DEFAULT 0,
  explorer_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS onchain_transfers_key_uidx ON onchain_transfers (key);
CREATE INDEX IF NOT EXISTS onchain_transfers_wallet_idx ON onchain_transfers (wallet);

CREATE TABLE IF NOT EXISTS platform_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  coop_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS platform_agents_status_idx ON platform_agents (status);
CREATE INDEX IF NOT EXISTS platform_agents_coop_idx ON platform_agents (coop_id);
`);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
    schemaReady = null;
  }
}

export * from "./schema";

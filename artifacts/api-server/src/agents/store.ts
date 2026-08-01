import { randomUUID } from 'node:crypto';
import { getPool } from '@workspace/db';
import type { AgentName, AgentTask, DomainEvent } from './types';

export class AgentStore {
  async initialize(): Promise<void> {
    const db = getPool();
    await db.query(`
      CREATE TABLE IF NOT EXISTS agent_events (
        id TEXT PRIMARY KEY,
        idempotency_key TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        payload JSONB NOT NULL,
        tx_hash TEXT,
        block_number BIGINT,
        occurred_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_tasks (
        id TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        event_id TEXT NOT NULL REFERENCES agent_events(id),
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL,
        run_after TIMESTAMPTZ NOT NULL,
        locked_at TIMESTAMPTZ,
        last_error TEXT,
        UNIQUE(agent, event_id)
      );
      CREATE INDEX IF NOT EXISTS agent_tasks_ready_idx
        ON agent_tasks(status, run_after);
      CREATE INDEX IF NOT EXISTS agent_tasks_agent_status_idx
        ON agent_tasks(agent, status);
      CREATE TABLE IF NOT EXISTS agent_memory (
        agent TEXT NOT NULL,
        memory_key TEXT NOT NULL,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(agent, memory_key)
      );
      CREATE TABLE IF NOT EXISTS agent_audit_log (
        id TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        idempotency_key TEXT,
        tx_hash TEXT,
        detail JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS agent_audit_agent_idx
        ON agent_audit_log(agent, created_at DESC);
    `);
  }

  /** Returns true when the event is new (idempotent insert). */
  async recordEvent(event: DomainEvent): Promise<boolean> {
    const result = await getPool().query(
      `INSERT INTO agent_events
         (id, idempotency_key, name, source, payload, tx_hash, block_number, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        event.id,
        event.idempotencyKey,
        event.name,
        event.source,
        event.payload,
        event.transactionHash ?? null,
        event.blockNumber != null ? String(event.blockNumber) : null,
        event.occurredAt,
      ],
    );
    return result.rowCount === 1;
  }

  async enqueue(
    agent: AgentName,
    event: DomainEvent,
    maxAttempts: number,
  ): Promise<void> {
    await getPool().query(
      `INSERT INTO agent_tasks (id, agent, event_id, max_attempts, run_after)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (agent, event_id) DO NOTHING`,
      [randomUUID(), agent, event.id, maxAttempts],
    );
  }

  async claim(agent: AgentName): Promise<AgentTask | null> {
    const result = await getPool().query(
      `
      WITH next AS (
        SELECT t.id
        FROM agent_tasks t
        WHERE t.agent = $1
          AND t.status = 'pending'
          AND t.run_after <= NOW()
        ORDER BY t.run_after
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE agent_tasks t
      SET status = 'running',
          locked_at = NOW(),
          attempts = attempts + 1
      FROM next, agent_events e
      WHERE t.id = next.id
        AND e.id = t.event_id
      RETURNING
        t.id,
        t.agent,
        t.attempts,
        t.max_attempts,
        t.run_after,
        e.id AS event_id,
        e.name,
        e.source,
        e.payload,
        e.tx_hash,
        e.block_number,
        e.occurred_at,
        e.idempotency_key
      `,
      [agent],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      agent: row.agent,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      runAfter: row.run_after,
      event: {
        id: row.event_id,
        name: row.name,
        source: row.source,
        payload: row.payload,
        transactionHash: row.tx_hash ?? undefined,
        blockNumber: row.block_number ? BigInt(row.block_number) : undefined,
        occurredAt: new Date(row.occurred_at).toISOString(),
        idempotencyKey: row.idempotency_key,
      },
    };
  }

  async complete(taskId: string): Promise<void> {
    await getPool().query(
      `UPDATE agent_tasks SET status = 'completed' WHERE id = $1`,
      [taskId],
    );
  }

  async retry(task: AgentTask, error: unknown): Promise<void> {
    const exhausted = task.attempts >= task.maxAttempts;
    const seconds = Math.min(300, 2 ** task.attempts);
    await getPool().query(
      `UPDATE agent_tasks
       SET status = $2,
           last_error = $3,
           run_after = NOW() + ($4 * INTERVAL '1 second'),
           locked_at = NULL
       WHERE id = $1`,
      [
        task.id,
        exhausted ? 'failed' : 'pending',
        error instanceof Error ? error.message : String(error),
        seconds,
      ],
    );
  }

  async remember(agent: AgentName, key: string, value: unknown): Promise<void> {
    await getPool().query(
      `INSERT INTO agent_memory (agent, memory_key, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (agent, memory_key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [agent, key, value],
    );
  }

  async recall<T = unknown>(agent: AgentName, key: string): Promise<T | null> {
    const result = await getPool().query(
      `SELECT value FROM agent_memory WHERE agent = $1 AND memory_key = $2`,
      [agent, key],
    );
    return result.rows[0]?.value ?? null;
  }

  async listMemory(
    agent: AgentName,
    limit = 50,
  ): Promise<Array<{ key: string; value: unknown; updatedAt: string }>> {
    const result = await getPool().query(
      `SELECT memory_key, value, updated_at
       FROM agent_memory
       WHERE agent = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      [agent, limit],
    );
    return result.rows.map((r) => ({
      key: r.memory_key,
      value: r.value,
      updatedAt: new Date(r.updated_at).toISOString(),
    }));
  }

  async audit(
    agent: AgentName,
    action: string,
    status: 'success' | 'blocked' | 'error',
    detail: unknown,
    idempotencyKey?: string,
    txHash?: string,
  ): Promise<void> {
    await getPool().query(
      `INSERT INTO agent_audit_log
         (id, agent, action, status, idempotency_key, tx_hash, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        randomUUID(),
        agent,
        action,
        status,
        idempotencyKey ?? null,
        txHash ?? null,
        detail,
      ],
    );
  }

  async queueDepth(agent: AgentName): Promise<number> {
    const result = await getPool().query(
      `SELECT COUNT(*)::int AS c
       FROM agent_tasks
       WHERE agent = $1 AND status IN ('pending', 'running')`,
      [agent],
    );
    return result.rows[0]?.c ?? 0;
  }

  async listAudit(
    agent?: AgentName,
    limit = 50,
  ): Promise<
    Array<{
      id: string;
      agent: string;
      action: string;
      status: string;
      idempotencyKey?: string;
      txHash?: string;
      detail: unknown;
      createdAt: string;
    }>
  > {
    const result = agent
      ? await getPool().query(
          `SELECT id, agent, action, status, idempotency_key, tx_hash, detail, created_at
           FROM agent_audit_log WHERE agent = $1
           ORDER BY created_at DESC LIMIT $2`,
          [agent, limit],
        )
      : await getPool().query(
          `SELECT id, agent, action, status, idempotency_key, tx_hash, detail, created_at
           FROM agent_audit_log
           ORDER BY created_at DESC LIMIT $1`,
          [limit],
        );

    return result.rows.map((r) => ({
      id: r.id,
      agent: r.agent,
      action: r.action,
      status: r.status,
      idempotencyKey: r.idempotency_key ?? undefined,
      txHash: r.tx_hash ?? undefined,
      detail: r.detail,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  }

  async recentEvents(limit = 50): Promise<DomainEvent[]> {
    const result = await getPool().query(
      `SELECT id, idempotency_key, name, source, payload, tx_hash, block_number, occurred_at
       FROM agent_events
       ORDER BY occurred_at DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map((r) => ({
      id: r.id,
      idempotencyKey: r.idempotency_key,
      name: r.name,
      source: r.source,
      payload: r.payload,
      transactionHash: r.tx_hash ?? undefined,
      blockNumber: r.block_number ? BigInt(r.block_number) : undefined,
      occurredAt: new Date(r.occurred_at).toISOString(),
    }));
  }
}

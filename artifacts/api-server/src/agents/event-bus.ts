import { EventEmitter } from 'node:events';
import type { AgentName, DomainEvent, DomainEventName } from './types';

type Handler = (event: DomainEvent) => void | Promise<void>;

/**
 * Process-local domain event bus.
 *
 * Production note: replace with NATS / Redis Streams / SQS behind the same
 * interface. The durable Postgres task queue remains the source of truth —
 * a bus restart cannot lose work that was already enqueued.
 */
export class AgentEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(64);
  }

  publish(event: DomainEvent): void {
    this.emitter.emit(event.name, event);
    this.emitter.emit('*', event);
  }

  /**
   * Subscribe an agent to specific event names (or all when names is empty).
   * Handlers must not throw — the runtime wraps enqueue failures.
   */
  subscribe(
    agent: AgentName,
    names: readonly DomainEventName[],
    handler: Handler,
  ): () => void {
    const wrapped: Handler = (event) => {
      try {
        const result = handler(event);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          void (result as Promise<void>).catch(() => undefined);
        }
      } catch {
        // Individual handlers enqueue durable work and must not break the bus.
      }
    };

    if (names.length === 0) {
      this.emitter.on('*', wrapped);
      return () => this.emitter.off('*', wrapped);
    }

    for (const name of names) {
      this.emitter.on(name, wrapped);
    }
    return () => {
      for (const name of names) {
        this.emitter.off(name, wrapped);
      }
    };
  }

  /** Debug / ops: count listeners for a channel. */
  listenerCount(name: DomainEventName | '*'): number {
    return this.emitter.listenerCount(name);
  }
}

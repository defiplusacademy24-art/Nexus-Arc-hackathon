/**
 * In-process rate limiter for dangerous wallet operations.
 * Multi-instance deployments should swap this for Redis; interface stays the same.
 */

export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly windowMs: number,
    private readonly max: number,
  ) {}

  /** Returns true if the call is allowed and records it. */
  tryConsume(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const prior = (this.hits.get(key) ?? []).filter((t) => t >= windowStart);
    if (prior.length >= this.max) {
      this.hits.set(key, prior);
      return false;
    }
    prior.push(now);
    this.hits.set(key, prior);
    return true;
  }

  remaining(key: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const prior = (this.hits.get(key) ?? []).filter((t) => t >= windowStart);
    this.hits.set(key, prior);
    return Math.max(0, this.max - prior.length);
  }
}

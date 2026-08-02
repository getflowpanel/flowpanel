/** Shared reconnect schedule for the realtime bus and the SSE connection pool. */

/** First reconnect delay; doubles per consecutive failure. */
const BASE_MS = 500;

/** Failures past which the delay stops doubling (500 * 2^6 = 32s, capped by `maxMs`). */
const CEILING_ATTEMPTS = 6;

/** Default cap on the exponential reconnect delay. */
export const DEFAULT_RECONNECT_MAX_MS = 30_000;

/**
 * Delay before the next reconnect. `attempt` is the number of consecutive
 * failures recorded *before* the one being handled, so the first retry waits
 * `BASE_MS`.
 */
export function backoffDelay(attempt: number, maxMs: number): number {
  return Math.min(maxMs, BASE_MS * 2 ** Math.min(attempt, CEILING_ATTEMPTS));
}

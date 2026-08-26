/** Shared SSE frame reader for the realtime bus and the SSE connection pool. */

export interface RealtimeFrame {
  channel: string;
  payload: unknown;
}

/**
 * Read one `{ channel, payload }` envelope. Anything else — malformed JSON, a
 * bare value, an envelope without a string channel — is not addressed to a
 * subscriber and yields `null` (ADR 0014).
 */
export function readFrame(data: unknown): RealtimeFrame | null {
  if (typeof data !== "string" || data === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const { channel, payload } = parsed as { channel?: unknown; payload?: unknown };
  if (typeof channel !== "string") return null;
  return { channel, payload };
}

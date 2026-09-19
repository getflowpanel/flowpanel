import { decodeEnvelope } from "@flowpanel/core/publish";

export interface RealtimeFrame {
  channel: string;
  payload: unknown;
}

/**
 * Read one `{ channel, payload }` SSE frame. Anything else — malformed JSON, a
 * bare value, an envelope without a string channel — is not addressed to a
 * subscriber and yields `null` (ADR 0014).
 */
export function readFrame(data: unknown): RealtimeFrame | null {
  if (typeof data !== "string" || data === "") return null;
  return decodeEnvelope(data);
}

import { decodeEnvelope } from "@flowpanel/core/publish";

export interface RealtimeFrame {
  channel: string;
  payload: unknown;
}

/** Reads one `{ channel, payload }` SSE frame; anything else is not addressed to a subscriber and yields `null`. */
export function readFrame(data: unknown): RealtimeFrame | null {
  if (typeof data !== "string" || data === "") return null;
  return decodeEnvelope(data);
}

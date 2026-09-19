/** The SSE frame body, `{channel, payload}` (ADR 0014), with `payload` omitted when there is none. */
export function encodeEnvelope(channel: string, payload: unknown): string {
  return payload === undefined ? JSON.stringify({ channel }) : JSON.stringify({ channel, payload });
}

/** Read an SSE frame body back. Returns `null` for anything that is not an envelope. */
export function decodeEnvelope(raw: string): { channel: string; payload: unknown } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const frame = parsed as { channel?: unknown; payload?: unknown };
  if (typeof frame.channel !== "string") return null;
  return { channel: frame.channel, payload: frame.payload };
}

/** The transport body: the payload as JSON, or an empty string when there is no payload. */
export function encodePayload(channel: string, payload: unknown): string {
  if (payload === undefined) return "";
  try {
    return JSON.stringify(payload);
  } catch (err) {
    throw new Error(
      `[flowpanel] realtime payload for channel "${channel}" is not JSON-serializable: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

/** Read a transport body back, falling back to the raw string when it is not JSON. */
export function decodePayload(raw: string): unknown {
  if (raw === "") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

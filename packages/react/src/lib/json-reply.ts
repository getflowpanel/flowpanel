/** A JSON body read field by field, so a route's answer is checked rather than assumed. */
export type Reply = Record<string, unknown>;

export function isReply(value: unknown): value is Reply {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** The response's JSON object, or an empty one when the body is not a JSON object. */
export async function readReply(response: Response): Promise<Reply> {
  const body: unknown = await response.json().catch(() => null);
  return isReply(body) ? body : {};
}

export function textOf(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

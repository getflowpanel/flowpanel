import type { ResolvedAdminConfig } from "@flowpanel/core";

const FALLBACK_WINDOW_MS = 60_000;

/** A 429 says when to try again: the rate limit's window, in whole seconds. */
export function withRetryAfter(res: Response, config: ResolvedAdminConfig): Response {
  if (res.status !== 429 || res.headers.has("retry-after")) return res;
  const windowMs = config.rateLimit?.windowMs ?? FALLBACK_WINDOW_MS;
  res.headers.set("Retry-After", String(Math.max(1, Math.ceil(windowMs / 1000))));
  return res;
}

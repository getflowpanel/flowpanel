import { log } from "./log";

/** Connection failures whose real cause is almost always an unset DATABASE_URL. */
function looksLikeMissingDbUrl(message: string): boolean {
  return (
    message.includes("client password must be a string") ||
    message.includes("SASL") ||
    message.includes("ECONNREFUSED")
  );
}

/**
 * Every message in the `cause` chain. Drizzle rethrows driver failures wrapped
 * in its own `Failed query: …`, so the tell-tale text is never on the top error.
 */
export function messageChain(err: unknown): string[] {
  const messages = [err instanceof Error ? err.message : String(err)];
  let cause: unknown = err instanceof Error ? err.cause : undefined;
  const seen = new Set<unknown>([err]);
  while (cause instanceof Error && messages.length < 10 && !seen.has(cause)) {
    seen.add(cause);
    messages.push(cause.message);
    cause = cause.cause;
  }
  return messages;
}

/** Avoid exposing credentials embedded in driver connection URLs or SQL parameter dumps. */
export function redactDiagnostic(message: string): string {
  return (
    message
      .replace(/([a-z][a-z\d+.-]*:\/\/)[^\s/@]+(?::[^\s/@]*)?@/gi, "$1[redacted]@")
      .replace(/\b(authorization\s*:\s*(?:basic|bearer)\s+)[^\s]+/gi, "$1[redacted]")
      .replace(
        /([?&](?:access_token|token|_authToken|auth|password|key|secret)=)[^&#\s]+/gi,
        "$1[redacted]",
      )
      // Registry and driver errors also print a bare `_authToken=…` or `"password": "…"`.
      .replace(
        /\b(_authToken|authToken|access_token|refresh_token|api[_-]?key|password|passwd|secret|token)("?\s*[=:]\s*"?)[^\s"',;&#]+/gi,
        "$1$2[redacted]",
      )
      .replace(/^(params|parameters):.*$/gim, "$1: [redacted]")
  );
}

/**
 * Turn a thrown value into one readable line plus a hint, instead of the raw
 * Node stack trace. `FLOWPANEL_DEBUG=1` keeps the stack for bug reports.
 */
export function reportFatal(err: unknown): void {
  const messages = messageChain(err).map(redactDiagnostic);

  if (!process.env.DATABASE_URL && messageChain(err).some(looksLikeMissingDbUrl)) {
    log.err("Could not connect to the database — DATABASE_URL is not set.");
    log.dim("  Add it to .env (or .env.local) next to package.json, or pass it inline:");
    log.dim("    DATABASE_URL=postgres://user:pass@host:5432/db pnpm flowpanel migrate");
  } else {
    log.err(messages[0] ?? "Unknown error");
  }
  for (const cause of messages.slice(1)) log.err(`Caused by: ${cause}`);

  if (process.env.FLOWPANEL_DEBUG && err instanceof Error && err.stack) {
    log.dim(redactDiagnostic(err.stack));
  } else {
    log.dim("  Re-run with FLOWPANEL_DEBUG=1 for the full stack trace.");
  }
}

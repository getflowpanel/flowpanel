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
  while (cause instanceof Error && messages.length < 10) {
    messages.push(cause.message);
    cause = cause.cause;
  }
  return messages;
}

/**
 * Turn a thrown value into one readable line plus a hint, instead of the raw
 * Node stack trace. `FLOWPANEL_DEBUG=1` keeps the stack for bug reports.
 */
export function reportFatal(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);

  if (!process.env.DATABASE_URL && messageChain(err).some(looksLikeMissingDbUrl)) {
    log.err("Could not connect to the database — DATABASE_URL is not set.");
    log.dim("  Add it to .env (or .env.local) next to package.json, or pass it inline:");
    log.dim("    DATABASE_URL=postgres://user:pass@host:5432/db pnpm flowpanel migrate");
  } else {
    log.err(message);
  }

  if (process.env.FLOWPANEL_DEBUG && err instanceof Error && err.stack) {
    log.dim(err.stack);
  } else {
    log.dim("  Re-run with FLOWPANEL_DEBUG=1 for the full stack trace.");
  }
}

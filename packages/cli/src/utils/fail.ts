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

const SOCKET_CODES = [
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ECONNRESET",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
] as const;
const PRISMA_CODES = ["P1001", "P1002", "P1017"] as const;
const CONNECTION_CODES: readonly string[] = [...SOCKET_CODES, ...PRISMA_CODES];
const SOCKET_CODE_PATTERN = new RegExp(`\\b(${SOCKET_CODES.join("|")})\\b`);
const DEFAULT_PORTS: Record<string, string> = {
  "postgres:": "5432",
  "postgresql:": "5432",
  "mysql:": "3306",
};

interface ErrorLike {
  code?: unknown;
  errorCode?: unknown;
  address?: unknown;
  hostname?: unknown;
  port?: unknown;
  errors?: unknown;
  message?: unknown;
  cause?: unknown;
}

function endpointOf(host: string, port: string | null): string {
  const shown = host.includes(":") ? `[${host}]` : host;
  return port ? `${shown}:${port}` : shown;
}

function endpointFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const { protocol, hostname, port } = new URL(url);
    return hostname ? endpointOf(hostname, port || DEFAULT_PORTS[protocol] || null) : null;
  } catch {
    return null;
  }
}

function endpointOfError(e: ErrorLike): string | null {
  const host = typeof e.address === "string" ? e.address : e.hostname;
  const port = typeof e.port === "number" || typeof e.port === "string" ? String(e.port) : null;
  if (typeof host === "string" && host) return endpointOf(host, port);
  const message = typeof e.message === "string" ? e.message : "";
  const prisma = /\bserver at `([^`\s]+)`(?::`(\d+)`)?/.exec(message);
  if (prisma?.[1]) {
    const target = prisma[1].slice(prisma[1].lastIndexOf("@") + 1);
    return prisma[2] ? `${target}:${prisma[2]}` : target;
  }
  return (
    /\b(?:connect|getaddrinfo)\s+E[A-Z_]+\s+(?![\w+.-]+:\/\/)((?:\d{1,3}\.){3}\d{1,3}(?::\d+)?|[\w.-]+(?::\d+)?)/.exec(
      message,
    )?.[1] ?? null
  );
}

function children(e: ErrorLike): ErrorLike[] {
  const nested = Array.isArray(e.errors) ? e.errors : [];
  return [...nested, e.cause].filter((c): c is ErrorLike => typeof c === "object" && c !== null);
}

/** The endpoint an error or the first error beneath it names. */
function findEndpoint(e: ErrorLike, depth = 0): string | null {
  const own = endpointOfError(e);
  if (own || depth > 4) return own;
  for (const child of children(e)) {
    const found = findEndpoint(child, depth + 1);
    if (found) return found;
  }
  return null;
}

/** The failed connection at the bottom of an error chain, as `{ code, endpoint }`, or `null`. */
export function connectionFailure(err: unknown): { code: string; endpoint: string | null } | null {
  const queue: ErrorLike[] = typeof err === "object" && err !== null ? [err] : [];
  const seen = new Set<ErrorLike>();
  while (queue.length > 0 && seen.size < 20) {
    const e = queue.shift() as ErrorLike;
    if (seen.has(e)) continue;
    seen.add(e);
    const message = typeof e.message === "string" ? e.message : "";
    const named = [e.code, e.errorCode].find(
      (value): value is string => typeof value === "string" && CONNECTION_CODES.includes(value),
    );
    const code = named ?? SOCKET_CODE_PATTERN.exec(message)?.[1];
    if (code) {
      return { code, endpoint: findEndpoint(e) ?? endpointFromUrl(process.env.DATABASE_URL) };
    }
    queue.push(...children(e));
  }
  return null;
}

/**
 * Turn a thrown value into one readable line plus a hint, instead of the raw
 * Node stack trace. `FLOWPANEL_DEBUG=1` keeps the stack for bug reports.
 */
export function reportFatal(err: unknown): void {
  const messages = messageChain(err).map(redactDiagnostic);
  const debug = Boolean(process.env.FLOWPANEL_DEBUG);
  const unreachable = connectionFailure(err);
  let details = messages.slice(1).map((cause) => `Caused by: ${cause}`);

  if (!process.env.DATABASE_URL && messageChain(err).some(looksLikeMissingDbUrl)) {
    log.err("Could not connect to the database — DATABASE_URL is not set.");
    log.dim("  Add it to .env (or .env.local) next to package.json, or pass it inline:");
    log.dim("    DATABASE_URL=postgres://user:pass@host:5432/db pnpm flowpanel migrate");
  } else if (unreachable) {
    const where = unreachable.endpoint ? ` at ${unreachable.endpoint}` : "";
    log.err(`Cannot reach the database${where} (${unreachable.code}). Check DATABASE_URL.`);
    details = debug ? messages : [];
  } else {
    log.err(messages[0] ?? "Unknown error");
  }
  for (const line of details) log.err(line);

  if (debug && err instanceof Error && err.stack) {
    log.dim(redactDiagnostic(err.stack));
  } else {
    log.dim("  Re-run with FLOWPANEL_DEBUG=1 for the failed query and stack trace.");
  }
}

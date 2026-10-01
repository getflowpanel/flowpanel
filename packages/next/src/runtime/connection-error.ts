const CONNECTION_CODES: ReadonlySet<string> = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ECONNRESET",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "28P01",
  "28000",
  "3D000",
  "08001",
  "08006",
  "P1000",
  "P1001",
  "P1002",
  "P1003",
  "P1017",
]);

const CONNECTION_MESSAGES = [
  /password authentication failed/i,
  /database "[^"]*" does not exist/i,
  /connect ECONNREFUSED/i,
  /can't reach database server/i,
];

interface ErrorLike {
  code?: unknown;
  errorCode?: unknown;
  message?: unknown;
  cause?: unknown;
  errors?: unknown;
}

function refused(err: ErrorLike): boolean {
  if (typeof err.code === "string" && CONNECTION_CODES.has(err.code)) return true;
  if (typeof err.errorCode === "string" && CONNECTION_CODES.has(err.errorCode)) return true;
  const message = err.message;
  return typeof message === "string" && CONNECTION_MESSAGES.some((re) => re.test(message));
}

/** The database refused the connection or could not be reached, anywhere along the error's causes. */
export function isConnectionError(err: unknown): boolean {
  const seen = new Set<unknown>();
  const pending: unknown[] = [err];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === null || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    const candidate = current as ErrorLike;
    if (refused(candidate)) return true;
    pending.push(candidate.cause);
    if (Array.isArray(candidate.errors)) pending.push(...candidate.errors);
  }
  return false;
}

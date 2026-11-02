const MAX_ERRORS = 8;
const MAX_MESSAGE = 500;

interface ErrorShape {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  cause?: unknown;
  errors?: unknown;
}

/** The first non-empty line, and the next after Prisma's "Invalid `…` invocation:", which only introduces it. */
function firstLine(text: string): string {
  const [first = "", next] = text.split("\n").filter((line) => line.trim() !== "");
  const line =
    /\binvocation:\s*$/.test(first) && next ? `${first.trim()} ${next.trim()}` : first.trim();
  return line.slice(0, MAX_MESSAGE);
}

function describeOne(value: unknown): string {
  if (value === null || typeof value !== "object") return firstLine(String(value));
  const shape = value as ErrorShape;
  const name = typeof shape.name === "string" && shape.name ? shape.name : "Error";
  const code =
    typeof shape.code === "string" || typeof shape.code === "number" ? ` [${shape.code}]` : "";
  const message = firstLine(typeof shape.message === "string" ? shape.message : "");
  return `${name}${code}${message ? `: ${message}` : ""}`;
}

/** An error, its `cause` chain and an AggregateError's `errors` as first lines only: drivers put query parameters, and so submitted values, on later lines. */
export function describeError(err: unknown): string {
  const seen = new Set<unknown>();
  const lines: string[] = [];
  const pending: unknown[] = [err];
  while (pending.length > 0 && lines.length < MAX_ERRORS) {
    const current = pending.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    lines.push(describeOne(current));
    if (current === null || typeof current !== "object") continue;
    const shape = current as ErrorShape;
    if (Array.isArray(shape.errors)) pending.push(...shape.errors);
    if (shape.cause !== undefined) pending.push(shape.cause);
  }
  return lines.join("\n  caused by: ");
}

/** What to log for a caught error: the object in development, where Next source-maps it; a bounded string in production. */
export function loggableError(err: unknown): unknown {
  return process.env.NODE_ENV === "production" ? describeError(err) : err;
}

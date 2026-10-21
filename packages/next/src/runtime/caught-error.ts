import { loggableError } from "@flowpanel/core/internal";

/** Next 16.4's dev renderer hangs serializing an AggregateError a render caught (16.5 canaries fix it), so a caught one becomes a plain Error. */
export function plainAggregates(err: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  const seen = new Set<unknown>();
  for (let current = err; current instanceof Error && !seen.has(current); current = current.cause) {
    seen.add(current);
    if (!(current instanceof AggregateError) || !Object.isExtensible(current)) continue;
    Object.defineProperty(current, "name", {
      value: current.name,
      configurable: true,
      writable: true,
    });
    Object.setPrototypeOf(current, Error.prototype);
  }
}

/** Logs an error the runtime caught and turned into a card or a fallback, readied for the dev renderer. */
export function logCaught(message: string, err: unknown): void {
  plainAggregates(err);
  console.error(message, loggableError(err));
}

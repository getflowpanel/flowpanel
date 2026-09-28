const ids = new WeakMap<object, number>();
let lastId = 0;

function identity(value: object): number {
  const known = ids.get(value);
  if (known !== undefined) return known;
  lastId += 1;
  ids.set(value, lastId);
  return lastId;
}

function argumentKey(value: unknown): string {
  if (value instanceof Date) return `d${value.getTime()}`;
  if ((typeof value === "object" && value !== null) || typeof value === "function") {
    return `o${identity(value)}`;
  }
  return typeof value === "string"
    ? `s${JSON.stringify(value)}`
    : `${typeof value}:${String(value)}`;
}

/** One memo key per function and argument list; objects compare by identity. */
export function callKey(fn: (...args: never[]) => unknown, args: readonly unknown[]): string {
  return [`f${identity(fn)}`, ...args.map(argumentKey)].join("|");
}

function stable(value: unknown): string {
  if (value instanceof Date) return `d${value.getTime()}`;
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(record[key])}`);
    return `{${entries.join(",")}}`;
  }
  if (typeof value === "bigint") return `${value}n`;
  return value === undefined ? "u" : JSON.stringify(value);
}

type Window = { from: Date; to: Date } | null | undefined;

const bounds = (window: Window): string =>
  window ? `@${window.from.getTime()}~${window.to.getTime()}` : "";

/**
 * One memo key per resource, `where` and — for a ranged count — the field and bounds, whatever
 * order the `where` was written in.
 */
export function countKey(
  resource: string,
  where: Record<string, unknown> | undefined,
  window?: ({ field: string } & NonNullable<Window>) | null,
): string {
  return `${resource}${stable(where ?? {})}${window ? `${window.field}${bounds(window)}` : ""}`;
}

/** One memo key per resource, read options and — for a ranged read — the bounds. */
export function readKey(resource: string, options: object | undefined, window?: Window): string {
  return `${resource}${stable(options ?? {})}${bounds(window)}`;
}

import { FlowpanelValidationError } from "@flowpanel/core";

export type WireValue =
  | null
  | boolean
  | number
  | string
  | WireValue[]
  | { [key: string]: WireValue };

function invalid(path: string, value: unknown): never {
  const kind =
    value !== null && typeof value === "object"
      ? (Object.getPrototypeOf(value)?.constructor?.name ?? "object")
      : value === null
        ? "null"
        : typeof value;
  throw new FlowpanelValidationError({
    [path]: `Value of type ${kind} is not serializable. Give it a toJSON(), or leave the column out of the exposed set.`,
  });
}

/** Strict server-to-client serializer shared by runtime metadata and JSON APIs. */
export function toWireValue(
  value: unknown,
  path = "value",
  seen = new WeakSet<object>(),
): WireValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return invalid(path, value);
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) {
    if (Number.isNaN(value.valueOf())) return invalid(path, value);
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return invalid(path, value);
    seen.add(value);
    const out = value.map((entry, index) => toWireValue(entry, `${path}[${index}]`, seen));
    seen.delete(value);
    return out;
  }
  if (typeof value === "object") {
    if (seen.has(value as object)) return invalid(path, value);
    // A class that declares toJSON has stated how it serializes — Prisma's Decimal does.
    // Anything that has not (a Map, a live database handle) still fails loudly.
    const toJson = (value as { toJSON?: unknown }).toJSON;
    if (typeof toJson === "function") {
      seen.add(value as object);
      const encoded = toWireValue((toJson as () => unknown).call(value), path, seen);
      seen.delete(value as object);
      return encoded;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return invalid(path, value);
    seen.add(value as object);
    const out: Record<string, WireValue> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry === undefined) continue;
      out[key] = toWireValue(entry, `${path}.${key}`, seen);
    }
    seen.delete(value as object);
    return out;
  }
  return invalid(path, value);
}

export interface FlowpanelClientMetadata {
  readonly id: string;
  readonly paths: { readonly admin: string; readonly api: string };
  readonly protocol: {
    readonly version: 1;
    readonly methods: readonly ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
  };
}

export function serializeClientMetadata(input: {
  id?: string;
  paths: { admin: string; api: string };
}): FlowpanelClientMetadata {
  return Object.freeze({
    id: input.id ?? "local",
    paths: Object.freeze({ admin: input.paths.admin, api: input.paths.api }),
    protocol: Object.freeze({
      version: 1 as const,
      methods: Object.freeze(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const),
    }),
  });
}

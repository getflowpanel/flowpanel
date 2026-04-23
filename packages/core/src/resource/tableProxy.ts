/**
 * TableProxy — runtime object that returns a ColumnRef on every property read.
 *
 * At the type level, `TableProxy<TTable>` maps every column of `TTable` to a
 * `ColumnRef<TValue>` carrying the inferred column value type. That's what
 * gives `defineResource(users, { columns: (u) => [u.email] })` its end-to-end
 * typing: `u.email` is not the raw Drizzle column — it's a FlowPanel token
 * that the builder can walk at config-load time.
 */

import { type ColumnRef, makeColumnRef } from "./columnRefs";
import type { FieldMetadata, ModelMetadata } from "./types";

export type TableProxy<TTable> = {
  readonly [K in keyof TTable]: ColumnRef<TTable[K]>;
};

/**
 * Build a table proxy from FlowPanel's `ModelMetadata`. Refs are memoized so
 * `proxy.email === proxy.email`, which lets callers use identity comparisons.
 */
export function createTableProxy<TTable>(metadata: ModelMetadata): TableProxy<TTable> {
  const fieldMap = new Map<string, FieldMetadata>();
  for (const field of metadata.fields) fieldMap.set(field.name, field);

  const refCache = new Map<string, ColumnRef>();
  const target = Object.create(null) as Record<string, unknown>;

  function get(prop: string): ColumnRef {
    const cached = refCache.get(prop);
    if (cached) return cached;
    const field = fieldMap.get(prop);
    if (!field) {
      const available = [...fieldMap.keys()].join(", ");
      throw new Error(
        `TableProxy(${metadata.name}): no column "${prop}". Available: ${available}.`,
      );
    }
    const ref = makeColumnRef(prop, field);
    refCache.set(prop, ref);
    return ref;
  }

  return new Proxy(target, {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined;
      return get(prop);
    },
    has(_target, prop) {
      return typeof prop === "string" && fieldMap.has(prop);
    },
    ownKeys() {
      return [...fieldMap.keys()];
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (typeof prop !== "string" || !fieldMap.has(prop)) return undefined;
      return { enumerable: true, configurable: true, value: get(prop) };
    },
  }) as TableProxy<TTable>;
}

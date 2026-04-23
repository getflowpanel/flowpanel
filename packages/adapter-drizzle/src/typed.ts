/**
 * `inferMetadata(table, { schema? })` — extract FlowPanel's `ModelMetadata`
 * from a Drizzle table at config-load time.
 *
 * When `opts.schema` is provided (the full imported `* as schema` bundle),
 * relations declared via Drizzle's `relations()` are expanded into extra
 * `FieldMetadata` entries with `kind: "relation"`. Without a schema, only
 * scalar columns are surfaced.
 *
 * Scalar column types (int / float / boolean / datetime / json / enum /
 * string) are mapped from Drizzle's stable `getTableColumns` descriptor.
 */

import type { FieldMetadata, ModelMetadata } from "@flowpanel/core";
import { getTableName } from "drizzle-orm";
import { buildModelMetadata, extractModelFromDrizzleTable } from "./metadata";

export interface InferMetadataOptions {
  /** Full schema bundle (typically `import * as schema`). Required for relations. */
  schema?: Record<string, unknown>;
}

export function inferMetadata(table: unknown, opts: InferMetadataOptions = {}): ModelMetadata {
  if (opts.schema) {
    // Find the table's key inside the schema so buildModelMetadata can follow
    // relations. Drizzle tables are referentially stable, so identity equality
    // is reliable here.
    for (const [key, val] of Object.entries(opts.schema)) {
      if (val === table) {
        return buildModelMetadata(opts.schema, key);
      }
    }
    // Fall through if the table isn't a direct schema value (e.g. sub-selects)
  }

  const name = getTableName(table as never);
  return extractModelFromDrizzleTable(name, table);
}

/** Convenience: list every table in the schema. */
export function schemaTableKeys(schema: Record<string, unknown>): string[] {
  const keys: string[] = [];
  for (const [key, val] of Object.entries(schema)) {
    if (!val || typeof val !== "object") continue;
    // Exclude relations objects (they have a `config` function).
    const hasConfig = typeof (val as { config?: unknown }).config === "function";
    if (hasConfig) continue;
    keys.push(key);
  }
  return keys;
}

// Track the cast retained for back-compat: `FieldMetadata` is re-exported so
// downstream callers don't need to reach into `@flowpanel/core` for typing.
export type { FieldMetadata };

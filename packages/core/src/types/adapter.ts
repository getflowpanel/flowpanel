import type { z } from "zod";
import type { ItemQueryContext, ListQueryContext, MutationContext } from "./context.js";
import type { InferDB } from "./registry.js";
import type { ListResult } from "./resource.js";

export interface ColumnMeta {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "json" | "enum" | "array" | "reference";
  nullable: boolean;
  unique: boolean;
  primaryKey: boolean;
  enumValues?: readonly string[];
  references?: { table: string; column: string };
  maxLength?: number;
}

export interface ResourceIntrospection {
  name: string;
  columns: ColumnMeta[];
  primaryKey: string;
}

/**
 * Adapter contract.
 *
 * - `DB` is the concrete driver handle (`NodePgDatabase`, `PrismaClient`, …).
 * - `Ref` is the *shape* of the per-resource reference each method accepts —
 *   a Drizzle `Table` for `drizzleAdapter`, a model-name `string` for
 *   `prismaAdapter`. Threading it through the methods lets adapter authors
 *   work with their native types inside the implementation rather than
 *   re-casting `unknown` on every line.
 *
 * Method return values stay `unknown` (or `ListResult<unknown>`) because the
 * runtime adapter cannot promise a caller-picked row shape — callers in
 * `@flowpanel/next` narrow the result with `as Record<string, unknown>` at
 * the dispatch boundary. The win is for adapter IMPLEMENTERS: they get a
 * properly typed `ref` parameter and no longer need wall-to-wall `as any`.
 */
export interface Adapter<DB = InferDB, Ref = unknown> {
  kind: "drizzle" | "prisma";
  db: DB;
  introspect(ref: Ref): ResourceIntrospection;
  inferSchema(ref: Ref): {
    create: z.ZodTypeAny;
    update: z.ZodTypeAny;
    select: z.ZodTypeAny;
  };
  list(ref: Ref, ctx: ListQueryContext<unknown>): Promise<ListResult<unknown>>;
  get(ref: Ref, ctx: ItemQueryContext): Promise<unknown | null>;
  create(ref: Ref, ctx: MutationContext<unknown>): Promise<unknown>;
  update(ref: Ref, ctx: MutationContext<unknown>): Promise<unknown>;
  delete(ref: Ref, ctx: MutationContext<unknown>): Promise<void>;
  restore?(ref: Ref, ctx: MutationContext<unknown>): Promise<void>;
  /**
   * Migration bookkeeping — used by `flowpanel migrate` to track which SQL
   * files in `flowpanel/migrations/` have already been applied. Optional on
   * the type so third-party adapters can ship without it, but both first-
   * party adapters (`drizzleAdapter`, `prismaAdapter`) implement them.
   *
   * `runMigrationSql(sql)` executes the raw migration SQL as-is.
   * `listAppliedMigrations()` ensures the `_flowpanel_migrations` table
   * exists and returns the set of already-applied migration IDs.
   * `markMigrationApplied(id)` records a single migration ID as applied.
   */
  runMigrationSql?(sql: string): Promise<void>;
  listAppliedMigrations?(): Promise<Set<string>>;
  markMigrationApplied?(id: string): Promise<void>;
}

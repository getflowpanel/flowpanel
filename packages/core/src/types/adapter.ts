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

export interface Adapter<DB = InferDB> {
  kind: "drizzle" | "prisma";
  db: DB;
  introspect(ref: unknown): ResourceIntrospection;
  inferSchema(ref: unknown): {
    create: z.ZodTypeAny;
    update: z.ZodTypeAny;
    select: z.ZodTypeAny;
  };
  list(ref: unknown, ctx: ListQueryContext<unknown>): Promise<ListResult<unknown>>;
  get(ref: unknown, ctx: ItemQueryContext): Promise<unknown | null>;
  create(ref: unknown, ctx: MutationContext<unknown>): Promise<unknown>;
  update(ref: unknown, ctx: MutationContext<unknown>): Promise<unknown>;
  delete(ref: unknown, ctx: MutationContext<unknown>): Promise<void>;
  restore?(ref: unknown, ctx: MutationContext<unknown>): Promise<void>;
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

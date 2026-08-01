import type { z } from "zod";
import type { ItemQueryContext, ListQueryContext, MutationContext } from "./context.js";
import type { InferDB } from "./registry.js";
import type { ListResult } from "./resource.js";

/** One column, as the adapter sees it. Drives inferred controls and validation. */
export interface ColumnMeta {
  name: string;
  /** Normalized type. Decides the default form control and filter. */
  type: "string" | "number" | "boolean" | "date" | "json" | "enum" | "array" | "reference";
  nullable: boolean;
  unique: boolean;
  primaryKey: boolean;
  /** Allowed values, for `enum` columns. */
  enumValues?: readonly string[];
  /** Foreign key target, when the column references another table. */
  references?: { table: string; column: string };
  maxLength?: number;
}

/** What the adapter reports about one table. */
export interface ResourceIntrospection {
  /** Table name, used as the resource's default `name`. */
  name: string;
  columns: ColumnMeta[];
  primaryKey: string;
}

/**
 * What FlowPanel needs from a database layer. Implement it to support an ORM
 * that has no shipped adapter — nothing else in the framework talks to the DB.
 */
/** Adapter identity. The shipped kinds autocomplete; third-party kinds are free-form. */
export type AdapterKind = "drizzle" | "prisma" | (string & {});

export interface Adapter<DB = InferDB, Ref = unknown> {
  /** Which ORM this adapter wraps. Shipped adapters use `"drizzle"` / `"prisma"`. */
  kind: AdapterKind;
  /** The client handed to every `ctx.db`. */
  db: DB;
  /** Describe a table: its columns, types and primary key. */
  introspect(ref: Ref): ResourceIntrospection;
  /** Derive validation schemas from the table, used when a resource sets no `schema`. */
  inferSchema(ref: Ref): {
    create: z.ZodTypeAny;
    update: z.ZodTypeAny;
    select: z.ZodTypeAny;
  };
  /** One page of rows, honoring filters, sort, search, scope and soft delete. */
  list(ref: Ref, ctx: ListQueryContext<unknown>): Promise<ListResult<unknown>>;
  /** A single row by id, or null. Must respect tenant scope. */
  get(ref: Ref, ctx: ItemQueryContext): Promise<unknown | null>;
  /** Insert a row. Must reject rows that fall outside the caller's scope. */
  create(ref: Ref, ctx: MutationContext<unknown>): Promise<unknown>;
  /** Update a row by id, or return null when it does not exist in scope. */
  update(ref: Ref, ctx: MutationContext<unknown>): Promise<unknown | null>;
  /** Delete a row — or stamp `ctx.softDelete.column` when soft delete is on. */
  delete(ref: Ref, ctx: MutationContext<unknown>): Promise<void>;
  /** Clear the soft-delete stamp. Without it, the admin hides the restore button. */
  restore?(ref: Ref, ctx: MutationContext<unknown>): Promise<void>;
  /** Optional migration support, used by `flowpanel migrate`. */
  runMigrationSql?(sql: string): Promise<void>;
  listAppliedMigrations?(): Promise<Set<string>>;
  markMigrationApplied?(id: string): Promise<void>;
}

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
  list(ref: unknown, ctx: ListQueryContext<any>): Promise<ListResult<any>>;
  get(ref: unknown, ctx: ItemQueryContext): Promise<any | null>;
  create(ref: unknown, ctx: MutationContext<any>): Promise<any>;
  update(ref: unknown, ctx: MutationContext<any>): Promise<any>;
  delete(ref: unknown, ctx: MutationContext<any>): Promise<void>;
  restore?(ref: unknown, ctx: MutationContext<any>): Promise<void>;
}

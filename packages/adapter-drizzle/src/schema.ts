import { isView } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { columnsOf } from "./columns";
import { isDecimalText } from "./introspect";

const NUMERIC = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/** A `numeric`/`decimal` value: a number or numeric text in, the text the driver stores out. */
const decimalText = z.union([z.number(), z.string()]).transform((value, ctx) => {
  const text = String(value).trim();
  if (Number.isFinite(Number(text)) && NUMERIC.test(text)) return text;
  ctx.addIssue({ code: "invalid_type", expected: "number", input: value });
  return z.NEVER;
});

function withDecimals(table: unknown, insert: z.ZodObject): z.ZodObject {
  const overrides: Record<string, z.ZodTypeAny> = {};
  for (const [name, column] of Object.entries(columnsOf(table))) {
    const original = insert.shape[name];
    if (!original || !isDecimalText(column)) continue;
    const nullable = original.safeParse(null).success;
    const optional = original.safeParse(undefined).success;
    const base = nullable ? decimalText.nullable() : decimalText;
    overrides[name] = optional ? base.optional() : base;
  }
  return Object.keys(overrides).length === 0 ? insert : insert.extend(overrides);
}

export function inferSchema(table: unknown): {
  create: z.ZodTypeAny;
  update: z.ZodTypeAny;
  select: z.ZodTypeAny;
} {
  if (isView(table)) {
    return { create: z.never(), update: z.never(), select: z.record(z.string(), z.unknown()) };
  }
  const insert = withDecimals(
    table,
    // biome-ignore lint/suspicious/noExplicitAny: drizzle-zod's generic is excessively deep (TS2589); cast through any, schemas validated at runtime.
    createInsertSchema(table as any) as unknown as z.ZodObject,
  );
  return {
    create: insert,
    update: insert.partial(),
    // biome-ignore lint/suspicious/noExplicitAny: see above — drizzle-zod TS2589.
    select: createSelectSchema(table as any) as unknown as z.ZodTypeAny,
  };
}

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

/** A `Date`, ISO 8601 text with an offset or `YYYY-MM-DD`: never `null`, a number or text without a zone. */
const jsonDate = z
  .union([z.date(), z.iso.datetime({ offset: true }), z.iso.date()])
  .pipe(z.coerce.date());

/** A date column also takes the ISO text a JSON body carries, as Prisma's schema does. */
const isDateColumn = (column: unknown): boolean =>
  (column as { dataType?: unknown }).dataType === "date";

function withJsonValues(table: unknown, insert: z.ZodObject): z.ZodObject {
  const overrides: Record<string, z.ZodTypeAny> = {};
  for (const [name, column] of Object.entries(columnsOf(table))) {
    const original = insert.shape[name];
    const value = !original
      ? undefined
      : isDecimalText(column)
        ? decimalText
        : isDateColumn(column)
          ? jsonDate
          : undefined;
    if (!original || !value) continue;
    const nullable = original.safeParse(null).success;
    const optional = original.safeParse(undefined).success;
    const base = nullable ? value.nullable() : value;
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
  const insert = withJsonValues(
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

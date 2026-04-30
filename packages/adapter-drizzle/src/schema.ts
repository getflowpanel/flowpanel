import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

export function inferSchema(table: unknown): {
  create: z.ZodTypeAny;
  update: z.ZodTypeAny;
  select: z.ZodTypeAny;
} {
  const insert = createInsertSchema(table as any);
  return {
    create: insert,
    update: insert.partial(),
    select: createSelectSchema(table as any),
  };
}

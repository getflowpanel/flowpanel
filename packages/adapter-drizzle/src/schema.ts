import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

export function inferSchema(table: unknown): {
  create: z.ZodTypeAny;
  update: z.ZodTypeAny;
  select: z.ZodTypeAny;
} {
  // biome-ignore lint/suspicious/noExplicitAny: drizzle-zod's generic is excessively deep (TS2589); cast through any, schemas validated at runtime.
  const insert = createInsertSchema(table as any) as unknown as z.ZodTypeAny;
  return {
    create: insert,
    // biome-ignore lint/suspicious/noExplicitAny: see above — drizzle-zod TS2589.
    update: (insert as any).partial() as z.ZodTypeAny,
    // biome-ignore lint/suspicious/noExplicitAny: see above — drizzle-zod TS2589.
    select: createSelectSchema(table as any) as unknown as z.ZodTypeAny,
  };
}

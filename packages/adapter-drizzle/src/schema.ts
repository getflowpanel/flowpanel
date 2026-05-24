import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

// Cast through `unknown` to flatten the deeply-instantiated generic returned
// by `drizzle-zod@^0.5` under Zod 4 (TS2589 "type instantiation is excessively
// deep"). The schemas are validated at runtime, not at the call site, so the
// loose `z.ZodTypeAny` is the contract callers see.
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

// tsd type tests for @flowpanel/adapter-prisma public surface.

import { prismaAdapter } from "@flowpanel/adapter-prisma";
import { expectAssignable } from "tsd";

declare const prisma: object;

// Factory accepts an explicit dmmf or falls back to runtime resolution.
const aWithDmmf = prismaAdapter({
  prisma,
  dmmf: { datamodel: { models: [], enums: [] } } as never,
});
expectAssignable<{ kind: "drizzle" | "prisma" }>(aWithDmmf);

// Without dmmf — adapter is still typed; runtime resolution happens lazily.
const aBare = prismaAdapter({ prisma });
expectAssignable<{ kind: "drizzle" | "prisma" }>(aBare);

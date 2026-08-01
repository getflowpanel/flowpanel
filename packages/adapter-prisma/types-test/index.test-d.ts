// tsd type tests for @flowpanel/adapter-prisma public surface.

import { prismaAdapter } from "@flowpanel/adapter-prisma";
import type { AdapterKind } from "@flowpanel/core";
import { expectAssignable } from "tsd";

declare const prisma: object;

// `kind` is an open union since ADR 0016 — the factory still labels itself.
// Factory accepts an explicit dmmf or falls back to runtime resolution.
const aWithDmmf = prismaAdapter({
  prisma,
  dmmf: { datamodel: { models: [], enums: [] } } as never,
});
expectAssignable<{ kind: AdapterKind }>(aWithDmmf);

// Without dmmf — adapter is still typed; runtime resolution happens lazily.
const aBare = prismaAdapter({ prisma });
expectAssignable<{ kind: AdapterKind }>(aBare);

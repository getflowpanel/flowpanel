// tsd type tests for @flowpanel/adapter-prisma public surface.

import { prismaAdapter } from "@flowpanel/adapter-prisma";
import type { AdapterKind } from "@flowpanel/core";
import { expectAssignable, expectError } from "tsd";

declare const prisma: object;

// `kind` is an open union since ADR 0016 — the factory still labels itself.
// Factory accepts an explicit dmmf or falls back to runtime resolution.
const aWithDmmf = prismaAdapter({
  prisma,
  provider: "postgresql",
  dmmf: { datamodel: { models: [], enums: [] } } as never,
});
expectAssignable<{ kind: AdapterKind }>(aWithDmmf);

// Without dmmf — adapter is still typed; runtime resolution happens lazily.
const aBare = prismaAdapter({ prisma, provider: "sqlite" });
expectAssignable<{ kind: AdapterKind }>(aBare);

// The provider decides how migrations lock and how SQL is split, so it is required.
expectError(prismaAdapter({ prisma }));
expectError(prismaAdapter({ prisma, provider: "cockroachdb" }));

// tsd type tests for @flowpanel/adapter-drizzle public surface.

import { drizzleAdapter } from "@flowpanel/adapter-drizzle";
import { expectAssignable } from "tsd";

// Adapter factory returns an Adapter whose kind narrows to "drizzle".
declare const db: object;
const a = drizzleAdapter({ db, schema: {}, dialect: "pg" });
expectAssignable<{ kind: "drizzle" | "prisma" }>(a);

// dialect accepts "pg" | "mysql" | "sqlite"
expectAssignable<{ kind: "drizzle" | "prisma" }>(
  drizzleAdapter({ db, schema: {}, dialect: "mysql" }),
);
expectAssignable<{ kind: "drizzle" | "prisma" }>(
  drizzleAdapter({ db, schema: {}, dialect: "sqlite" }),
);

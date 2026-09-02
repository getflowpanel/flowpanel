// tsd type tests for @flowpanel/adapter-drizzle public surface.

import { drizzleAdapter } from "@flowpanel/adapter-drizzle";
import type { AdapterKind } from "@flowpanel/core";
import { expectAssignable } from "tsd";

// `kind` is an open union since ADR 0016 — the factory still labels itself.
declare const db: object;
const a = drizzleAdapter({ db, schema: {}, dialect: "pg" });
expectAssignable<{ kind: AdapterKind }>(a);

// dialect accepts "pg" | "mysql" | "sqlite"
expectAssignable<{ kind: AdapterKind }>(drizzleAdapter({ db, schema: {}, dialect: "mysql" }));
expectAssignable<{ kind: AdapterKind }>(drizzleAdapter({ db, schema: {}, dialect: "sqlite" }));

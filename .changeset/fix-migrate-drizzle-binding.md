---
"@flowpanel/cli": patch
"@flowpanel/core": patch
"@flowpanel/adapter-drizzle": patch
"@flowpanel/adapter-prisma": patch
---

`flowpanel migrate` now works against Drizzle. The previous implementation passed `$1` parameters via `db.execute(sql, params)` which Drizzle doesn't honor; Postgres crashed with `there is no parameter $1`. Migration bookkeeping moved to a new `Adapter.markMigrationApplied(id)` / `listAppliedMigrations()` / `runMigrationSql(sql)` trio implemented per-adapter — Drizzle uses the `sql` template tag, Prisma uses `$executeRaw`.

Also: error messages from config loading now surface the real cause instead of always suggesting "install jiti"; jiti is now invoked with `jsx: true` and tsconfig-paths-aware aliases so `.tsx` sidecar imports and `@/*` path mappings work out of the box.

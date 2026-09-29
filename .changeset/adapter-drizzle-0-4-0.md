---
"@flowpanel/adapter-drizzle": minor
---

- Added reads of Drizzle views declared with `.existing()`.
- Fixed `ctx.sql` binding a `Date` or `bigint` inside a nested `sql` fragment.
- Removed the deprecated `runMigrationSql`, `markMigrationApplied`, `applyScope` and `scopeRequired` (use `applyMigration` and `boundScope`); a bound scope that adds no condition now always throws.

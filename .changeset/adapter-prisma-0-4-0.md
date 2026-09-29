---
"@flowpanel/adapter-prisma": minor
---

- Removed the deprecated `runMigrationSql`, `markMigrationApplied`, `applyScope` and `scopeRequired` (use `applyMigration` and `boundScope`); a bound scope that leaves the query unchanged now always throws.

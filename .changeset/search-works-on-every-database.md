---
"@flowpanel/adapter-prisma": patch
"@flowpanel/adapter-drizzle": patch
---

Make list search behave the same on every supported database.

The Prisma adapter passed `mode: "insensitive"` unconditionally, but Prisma
accepts `mode` only on PostgreSQL — any `?search=` against a SQLite or MySQL
resource threw `Unknown argument 'mode'` and 500'd the page. The flag is now
sent only to PostgreSQL; MySQL and SQLite already compare case-insensitively
under their default collations. A real-client integration test now searches on
SQLite so this class of provider-only argument can't ship green again.

The Drizzle adapter interpolated the raw query into `LIKE '%…%'`, so searching
for `100%` matched every row. `%`, `_` and the escape character are now escaped
and the pattern runs with an explicit `ESCAPE`, on all three dialects.

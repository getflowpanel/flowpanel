---
"@flowpanel/adapter-drizzle": patch
---

`ctx.sql` binds a `Date` or a `bigint` inside a nested Drizzle `sql` fragment, at any depth and inside an aliased fragment, as ISO or decimal text, as it already did for top-level values, so shared window and scope fragments compose on Postgres and SQLite. A fragment keeps its `inlineParams()` and `mapWith` decoder.

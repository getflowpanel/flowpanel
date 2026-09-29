---
"@flowpanel/adapter-drizzle": patch
---

The adapter lists, reads, filters, sorts and counts a Drizzle view declared with `.existing()`, reports it as `kind: "view"`, and never validates a write against it. `ctx.sql` binds a `Date` or a `bigint` inside a nested `sql` fragment, at any depth and inside an aliased fragment, as it already did for top-level values, so shared window and scope fragments compose on Postgres and SQLite; a fragment keeps its `inlineParams()` and `mapWith` decoder.

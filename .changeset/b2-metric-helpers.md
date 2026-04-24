---
"@flowpanel/core": minor
---

feat: add `metric()`, `timeseries()`, and `breakdown()` helpers plus
`parseRange` / `previousRange` / `defaultBucketFor` utilities. These remove
the repetitive boilerplate around time-windowed metric queries: scalar +
auto previous-period trend, time-bucketed series, dimension grouping with
sort + limit. ORM-agnostic — works with Drizzle, Prisma, or raw SQL.

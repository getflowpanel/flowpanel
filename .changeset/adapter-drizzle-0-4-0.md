---
"@flowpanel/adapter-drizzle": minor
---

- Added reads of Drizzle views declared with `.existing()`.
- Fixed `ctx.sql` binding a `Date` or `bigint` inside a nested `sql` fragment.
- Breaking: a resource `scope` function that returns the query unchanged now throws instead of running it unscoped.
- Removed the aliases deprecated in 0.3; see @flowpanel/core and the [upgrade guide](https://flowpanel.tech/docs/guides/upgrade).
- Changed Drizzle forms to reject a fractional value for an integer column before it reaches the database; schemas now come from drizzle-zod 0.8, which supports Zod 4.
- Changed `get` to answer `null` when Postgres rejects the id as text for the key's type (22P02), such as `not-a-uuid` for a uuid key, so the record page shows not found instead of an error.
- Fixed a `numeric` or `decimal` column (Postgres, MySQL, SQLite) getting a text box and failing "12,50" or "abc" with an Internal server error. It is now a number field, a value that is not a number answers 422 "Total must be a number", and the value is written and read as text, so `12.50` stays `"12.50"`.

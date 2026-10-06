---
"@flowpanel/adapter-prisma": minor
---

- Breaking: a resource `scope` function that returns the query unchanged now throws instead of running it unscoped.
- Removed the aliases deprecated in 0.3; see @flowpanel/core and the [upgrade guide](https://flowpanel.tech/docs/guides/upgrade).
- Fixed a Prisma 7 client silently producing wrong columns and keys: Prisma 7 removed the field metadata from `Prisma.dmmf`, so the adapter now stops with an error that names the supported Prisma 5 and 6.
- Fixed `Decimal` columns logging a React warning per row and losing their scale: reads and writes now return them as strings at the `@db.Decimal` scale, so `49.90` stays `"49.90"`. Prisma 5 does not report the scale, so there the value reads `"49.9"`.
- Fixed create forms requiring every column with a `@default(...)` or `@updatedAt`, such as `createdAt DateTime @default(now())`: the adapter read a DMMF property Prisma does not have and saw no defaults. Those columns are now optional on create, and a `String @id` without a default is kept in the create input instead of being dropped.
- Changed `get` to answer `null` for an id that cannot be the model's key, such as `abc` for an `Int @id` or a malformed UUID (P2023), so the record page shows not found instead of an error.
- Fixed a `reference` column to a model with an `Int` key, and a list filter on an `Int`, `BigInt` or `Float` field, failing with a Prisma validation error: the adapter turns the string values into numbers before the query.

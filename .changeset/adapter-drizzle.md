---
"@flowpanel/adapter-drizzle": minor
---

List search, the fail-closed scope rule and migration safety are now shared with the Prisma adapter rather than defined twice, and migration SQL that would break the applied-marker transaction is refused. Introspection is memoized per table instead of rebuilt on every call.

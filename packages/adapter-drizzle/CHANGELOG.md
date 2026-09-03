# @flowpanel/adapter-drizzle

## 0.2.0

### Minor Changes

- 2804944: List search, the fail-closed scope rule and migration safety are now shared with the Prisma adapter rather than defined twice, and migration SQL that would break the applied-marker transaction is refused. Introspection is memoized per table instead of rebuilt on every call.

### Patch Changes

- Updated dependencies [2804944]
  - @flowpanel/core@0.2.0

## 0.1.0

First public release. Drizzle ORM adapter for FlowPanel — Postgres, MySQL, and SQLite, with schema introspection, scoped queries, and soft-delete.

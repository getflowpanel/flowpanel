# @flowpanel/adapter-prisma

## 0.3.0

### Minor Changes

- Added the `sql` and `count` capabilities through `$queryRaw` with bound parameters.
- Added `hasDefault` to column introspection.

## 0.2.0

### Minor Changes

- Added `flowpanel migrate` support.
- Fixed creates failing under a filter-shaped tenant scope.
- Changed introspection to report database-generated ids as Drizzle does.

## 0.1.0

First public release. Prisma ORM adapter for FlowPanel, with schema introspection, scoped queries, and soft-delete.

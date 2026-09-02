# @flowpanel/adapter-prisma

## 0.2.0

### Minor Changes

- 2804944: Prisma gains real `flowpanel migrate` support, creates that respect a filter-shaped tenant scope instead of failing, and introspection that reports database-generated ids the way Drizzle does.

### Patch Changes

- Updated dependencies [2804944]
  - @flowpanel/core@0.2.0

## 0.1.0

First public release. Prisma ORM adapter for FlowPanel, with schema introspection, scoped queries, and soft-delete.

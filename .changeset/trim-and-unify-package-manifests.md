---
"@flowpanel/adapter-drizzle": patch
"@flowpanel/adapter-prisma": patch
"@flowpanel/charts": patch
"@flowpanel/core": patch
"@flowpanel/eslint-plugin": patch
"@flowpanel/next": patch
"@flowpanel/react": patch
---

Build every package with the same script, and drop unused dev dependencies.

`core`, `next`, `react` and `charts` cleaned `dist` with a shell
`rm -rf dist && tsup`, which fails on Windows — a contributor there could not
run `pnpm build` at all. The multi-config packages clear `dist` once from the
config module instead, and every package's build script is now plain `tsup`.

`testcontainers` was declared by both adapters but imported by neither (the
`@testcontainers/postgresql` and `@testcontainers/mysql` modules bring it
themselves), `pg` and `@types/pg` were declared by the Drizzle adapter whose
PostgreSQL tests use `postgres`, and `@typescript-eslint/parser` was declared by
the ESLint plugin, which reaches it through `@typescript-eslint/rule-tester`.

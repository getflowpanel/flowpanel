# @flowpanel/adapter-drizzle

Drizzle ORM adapter for FlowPanel.

[![npm](https://img.shields.io/npm/v/@flowpanel/adapter-drizzle.svg)](https://www.npmjs.com/package/@flowpanel/adapter-drizzle)

> Most users import from **`@flowpanel/kit/drizzle`** (umbrella subpath).

## Use

```ts
import { drizzleAdapter } from "@flowpanel/kit/drizzle";
import { db } from "@/db/client";
import * as schema from "@/db/schema";

export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),
  // ...
});
```

`dialect` is inferred from the first drizzle table in `schema` (`pgTable` → `pg`,
`mysqlTable` → `mysql`, `sqliteTable` → `sqlite`). If `schema` carries no table,
construction throws — pass the dialect explicitly instead:

```ts
drizzleAdapter({ db, schema, dialect: "mysql" })   // "pg" | "mysql" | "sqlite"
```

## What it implements

The full `Adapter` contract from `@flowpanel/core`:

- `introspect(ref)` — column meta from drizzle's `getTableColumns`
- `inferSchema(ref)` — Zod create / update / select via `drizzle-zod`
- `list / get / create / update / delete / restore` — with soft-delete (`ctx.softDelete?.column`)
- `applyMigration / listAppliedMigrations` — SQL migration execution and bookkeeping

## Dialect support

- **Postgres** — full support, uses `RETURNING` for `create` / `update`
- **MySQL 8** — `RETURNING` not supported; insert-then-select-by-pk
- **SQLite** — same as MySQL; `:memory:` works for tests

Ordinary multi-statement files are split without breaking semicolons inside
quoted strings, comments, identifiers or PostgreSQL dollar-quoted bodies.
Unsupported client `DELIMITER` directives and procedural bodies are rejected
before execution instead of being split unsafely.

PostgreSQL and SQLite execute all statements and the applied marker in one
transaction. They serialize and recheck the migration ID inside that database
boundary, so two `flowpanel migrate` processes cannot execute the same file.
MySQL uses a connection-pinned advisory lock and the same recheck, then executes
statements individually and records the ID last. MySQL implicitly commits DDL,
so migration files must still be reviewed, backed up and restart-safe: neither
the advisory lock nor the surrounding callback can roll partial DDL back.

## Documentation

<https://flowpanel.tech>

## License

MIT

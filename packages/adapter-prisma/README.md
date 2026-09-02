# @flowpanel/adapter-prisma

Prisma ORM adapter for FlowPanel — runtime DMMF introspection, no codegen.

[![npm](https://img.shields.io/npm/v/@flowpanel/adapter-prisma.svg)](https://www.npmjs.com/package/@flowpanel/adapter-prisma)

> Most users import from **`@flowpanel/kit/prisma`** (umbrella subpath).

## Use

```ts
import { prismaAdapter } from "@flowpanel/kit/prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default defineAdmin({
  adapter: prismaAdapter({ prisma, provider: "postgresql" }),
  resources: [
    resource("User", { columns: ["email", "role"] }),
  ],
});
```

`provider` is the `datasource` provider from your `schema.prisma` —
`"postgresql"`, `"mysql"` or `"sqlite"`. Migrations lock and split SQL
differently per provider, so the adapter will not guess it.

`Prisma.dmmf` resolves at runtime — no generator step beyond the standard `prisma generate`. Pass `dmmf` explicitly if you've vendored or trimmed it.

## What it implements

- Full CRUD via Prisma delegate methods (`prisma.user.findMany / findUnique / create / update / delete / count`)
- Soft-delete + `restore` via `ctx.softDelete.column`
- Insensitive search (Postgres only — Prisma silently ignores `mode: "insensitive"` on MySQL/SQLite)
- ID coercion: string `ctx.id` is parsed to Int / BigInt for numeric PKs at the adapter boundary, with descriptive errors on `NaN`
- `applyMigration / listAppliedMigrations` for `flowpanel migrate`, plus the compatibility `runMigrationSql / markMigrationApplied` hooks

## Migrations

`applyMigration` serializes migrators at the database and rechecks the ID under
that lock, so a second `flowpanel migrate` never replays a file.

- **PostgreSQL** — an advisory lock, the recheck, every statement and the applied marker in one transaction.
- **SQLite** — the same, behind the database write lock the transaction takes on its first write.
- **MySQL** — DDL commits implicitly, so nothing can roll an arbitrary file back. The adapter claims a durable row in `_flowpanel_migration_claims` instead. The claim serializes migrators, outlives a crashed one, and records the statement a failed run stopped at; later runs refuse that ID until you repair the schema and delete the row, so a half-applied file is never silently retried.

Review and back up production migrations, and keep MySQL DDL restart-safe.

The adapter safely splits ordinary multi-statement SQL, including quoted values,
comments, identifiers, and PostgreSQL dollar-quoted bodies. Dialect-specific
procedural scripts such as SQLite/MySQL triggers and stored procedures are
rejected before execution unless their body is PostgreSQL dollar-quoted, and so
are MySQL executable comments and client directives such as `DELIMITER`,
`SOURCE` and `.read`. Apply those through the ORM's native migration workflow;
FlowPanel never marks a rejected file applied.

## Peer dependency

`@prisma/client >=5.0.0 <7.0.0` (optional peer — only required if you use this adapter).

## Documentation

<https://flowpanel.tech>

## License

MIT

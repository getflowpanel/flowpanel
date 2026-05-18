# @flowpanel/adapter-prisma

Prisma ORM adapter for FlowPanel — runtime DMMF introspection, no codegen.

[![npm](https://img.shields.io/npm/v/@flowpanel/adapter-prisma.svg)](https://www.npmjs.com/package/@flowpanel/adapter-prisma)

> Most users import from **`flowpanel/prisma`** (umbrella subpath).

## Use

```ts
import { prismaAdapter } from "flowpanel/prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default defineAdmin({
  adapter: prismaAdapter({ prisma }),
  resources: [
    resource<unknown>("user", { columns: ["email", "role"] }),
  ],
});
```

`Prisma.dmmf` resolves at runtime — no generator step beyond the standard `prisma generate`. Pass `dmmf` explicitly if you've vendored or trimmed it.

## What it implements

- Full CRUD via Prisma delegate methods (`prisma.user.findMany / findUnique / create / update / delete / count`)
- Soft-delete + `restore` via `ctx.softDelete.column`
- Insensitive search (Postgres only — Prisma silently ignores `mode: "insensitive"` on MySQL/SQLite)
- ID coercion: string `ctx.id` is parsed to Int / BigInt for numeric PKs at the adapter boundary, with descriptive errors on `NaN`

## Peer dependency

`@prisma/client >=5.0.0 <7.0.0` (optional peer — only required if you use this adapter).

## Documentation

<https://flowpanel.dev>

## License

MIT

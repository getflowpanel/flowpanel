---
title: 'Adapters'
description: 'FlowPanel ships two ORM adapters and one queue integration. All implement the Adapter interface in @flowpanel/core.'
---


FlowPanel ships two ORM adapters (`@flowpanel/adapter-drizzle`,
`@flowpanel/adapter-prisma`) and one queue integration
(`@flowpanel/adapter-bullmq`). All implement the `Adapter` interface in
`@flowpanel/core` (`packages/core/src/types/adapter.ts:23`).

## The `Adapter` contract

```ts
interface Adapter<DB = InferDB> {
  kind: "drizzle" | "prisma";
  db: DB;
  introspect(ref: unknown): ResourceIntrospection;
  inferSchema(ref: unknown): { create: ZodTypeAny; update: ZodTypeAny; select: ZodTypeAny };
  list(ref, ctx: ListQueryContext): Promise<ListResult<unknown>>;
  get(ref, ctx: ItemQueryContext): Promise<unknown | null>;
  create(ref, ctx: MutationContext): Promise<unknown>;
  update(ref, ctx: MutationContext): Promise<unknown>;
  delete(ref, ctx: MutationContext): Promise<void>;
  restore?(ref, ctx: MutationContext): Promise<void>;
}
```

(`packages/core/src/types/adapter.ts:23`).

`ResourceIntrospection` carries `{ name, columns, primaryKey }` where
each `ColumnMeta` exposes `{ name, type, nullable, unique, primaryKey,
enumValues?, references?, maxLength? }`
(`packages/core/src/types/adapter.ts:6`).

## Drizzle — `drizzleAdapter`

```ts
import { drizzleAdapter } from "@flowpanel/adapter-drizzle";

const adapter = drizzleAdapter({ db, schema, dialect: "pg" });
```

Source: `packages/adapter-drizzle/src/adapter.ts:18`. Options:

| Option | Type | Default |
|---|---|---|
| `db` | typed Drizzle `db` instance | required |
| `schema` | `Record<string, unknown>` (the imported schema module) | required |
| `dialect` | `"pg" \| "mysql" \| "sqlite"` | `"pg"` |

The dialect controls which `LIKE` operator is used for search
(Postgres: `ilike`; others: `like`).

**Introspection** is column-level only
(`packages/adapter-drizzle/src/introspect.ts:4`). Mapped types: `string
| number | boolean | date | json | enum | array`. Enum values come
from `column.enumValues`. Relation introspection / nested filter
translation are not implemented.

> **WIP — Drizzle relation metadata (`relationModel`, `isList`,
> `buildModelMetadata`) is not implemented.** The adapter introspects
> column shapes only; relational eager-loading must be done in user
> `listQuery` / `itemQuery` callbacks.

Companion exports: `inferSchema(ref)` (Zod schema generator),
`introspect(ref)`, and CSV/JSON export helpers `toCsv` / `toJson`
(`packages/adapter-drizzle/src/index.ts:1`).

## Prisma — `prismaAdapter`

```ts
import { prismaAdapter } from "@flowpanel/adapter-prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const adapter = prismaAdapter({ prisma });

// Or supply DMMF explicitly (e.g. for a non-default Prisma client path):
const adapter2 = prismaAdapter({ prisma, dmmf });
```

Source: `packages/adapter-prisma/src/adapter.ts:59`. Loads DMMF lazily
from `@prisma/client` to introspect models, then delegates list / get /
mutation calls to the matching `prisma.<model>` delegate.

**Introspection** carries DMMF `FieldMetadata`, including `isList`,
`relationModel`, and `kind: "scalar" | "enum" | "object"`
(`packages/adapter-prisma/src/introspect.ts:1`).

## BullMQ — `bullmqAdapter`

Used to wrap a record of BullMQ `Queue` instances for the queue page.
See [Queues](../queues/) for the full setup. The helper is at
`packages/adapter-bullmq/src/adapter.ts:17`. Companion export:
`startBoardServer(opts)` to mount [bull-board](https://github.com/felixmosh/bull-board).

## Supported runtime versions

| Package | Minimum |
|---|---|
| `@prisma/client` | `>= 5` |
| `drizzle-orm` | `>= 0.30` |
| `bullmq` | `>= 5` |
| `next` | `>= 15` |
| `react` | `>= 19` |

(See `packages/flowpanel/package.json` peer-dependency block.)

## Feature parity at a glance

| Feature | Drizzle | Prisma |
|---|---|---|
| List with filters / sort / paging | yes | yes |
| Get by primary key | yes | yes |
| Create / update / delete | yes | yes |
| Soft-delete (`UPDATE … SET <col> = now()`) | yes | yes |
| Column introspection (type, nullable, unique, PK, enumValues) | yes | yes |
| Relation introspection (`relationModel`, `isList`) | no | yes |
| Nested filter paths (`relation.field`) | no | partial (via `where`) |
| Composite primary keys | no | no |

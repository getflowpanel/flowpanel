# @flowpanel/adapter-drizzle

Drizzle ORM adapter for [FlowPanel](https://github.com/Ch4m4/flowpanel) — a type-safe admin panel framework for Next.js.

[![npm](https://img.shields.io/npm/v/@flowpanel/adapter-drizzle)](https://www.npmjs.com/package/@flowpanel/adapter-drizzle)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/Ch4m4/flowpanel/blob/main/LICENSE)

## Installation

```bash
npm install @flowpanel/adapter-drizzle drizzle-orm
# or
pnpm add @flowpanel/adapter-drizzle drizzle-orm
```

## Quick start

```ts
// flowpanel.config.ts
import { defineFlowPanel, resource } from "@flowpanel/core";
import { drizzleAdapter } from "@flowpanel/adapter-drizzle";
import { db } from "./db";           // your Drizzle db instance
import * as schema from "./schema";  // tables + relations() exports

export default defineFlowPanel({
  adapter: drizzleAdapter({ db, schema }),
  resources: {
    posts: resource(schema.posts),
  },
});
```

> Duck-typed shorthand also works: `adapter: db` — FlowPanel detects Drizzle automatically.

Pass a lazy initializer if `db` is not available at module load time:

```ts
adapter: drizzleAdapter({ db: () => import("./db").then((m) => m.db) })
```

## Schema requirements

Define your tables and their relations using Drizzle's `relations()` helper.
The adapter reads `relations()` exports at config time to populate `relationModel`
on each `FieldMetadata` entry.

```ts
// schema.ts
import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  authorId: integer("author_id").references(() => users.id).notNull(),
});

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));
```

Pass `import * as schema from "./schema"` (not just the tables) so the adapter
can find the `relations()` exports.

## Metadata API

### `extractModelFromDrizzleTable(modelName, tableObj)`

Extracts scalar column metadata from a single Drizzle table object.
Does not populate relation fields.

```ts
import { extractModelFromDrizzleTable } from "@flowpanel/adapter-drizzle";
import { posts } from "./schema";

const meta = extractModelFromDrizzleTable("posts", posts);
// { name: "posts", fields: [{ name: "id", kind: "scalar", ... }, ...], primaryKey: "id" }
```

### `buildModelMetadata(schema, tableKey)`

Extracts full metadata — scalar columns **and** relation fields — from a complete
Drizzle schema (tables + `relations()` exports).

```ts
import { buildModelMetadata } from "@flowpanel/adapter-drizzle";
import * as schema from "./schema";

const meta = buildModelMetadata(schema, "posts");
// meta.fields includes:
//   { name: "author", kind: "relation", relationModel: "users", isList: false }
```

Throws if `tableKey` is not found in the schema.

## Supported features

See the [adapter parity matrix](../../docs/reference/adapters.md) for a full feature comparison with the Prisma adapter.

| Feature | Status |
|---|---|
| CRUD (list, count, findOne, create, update, delete) | ✅ |
| Scalar filters (14 operators) | ✅ |
| Multi-filter (AND) | ✅ |
| Sort (`asc` / `desc`) | ✅ |
| Relation eager-loading | ✅ (relational query API) |
| `relationModel` from `relations()` | ✅ (`buildModelMetadata`) |
| Enum field detection | ✅ |
| Nested filter paths (`relation.field`) | ⚠️ Beta limitation — skipped with warning |
| Composite primary keys | ⚠️ Not supported in beta |

## Requirements

- `drizzle-orm >= 0.30`
- `next >= 15`
- `react >= 18`

## Documentation

[https://flowpanel.tech/docs/adapters/drizzle](https://flowpanel.tech/docs/adapters/drizzle)

## License

MIT

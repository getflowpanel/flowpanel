# Typing `ctx.db`

Every server-side callback FlowPanel hands you — per-resource
`listQuery` / `itemQuery`, action `run`, drawer-action `run`, widget
`query`, `scope` — receives a `ctx` with `db` on it. That `db` is your
real Drizzle or Prisma client; FlowPanel doesn't wrap it. To get
autocomplete and type narrowing across the whole config without
per-callsite annotations or codegen, augment one interface.

## The pattern

```ts
// flowpanel.config.ts
import { defineAdmin, resource } from "flowpanel";
import { drizzleAdapter } from "flowpanel/drizzle";
import { db } from "@/db/client";
import * as schema from "@/db/schema";

declare module "@flowpanel/core" {
  interface FlowpanelTypes {
    db: typeof db;
  }
}

export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),
  resources: [
    resource(schema.users, {
      listQuery: async ({ db }) => {
        // db is typed `typeof import("@/db/client").db` — full autocomplete.
        const rows = await db.select().from(schema.users);
        return { rows, total: rows.length, page: 1, pageSize: rows.length };
      },
    }),
  ],
});
```

That's the whole API. One `declare module` block, applied once at the
top of your config (or any file in the type-graph), narrows `db` in
every widget, action, and resource callback FlowPanel exposes.

## The registry interface

`packages/core/src/types/registry.ts:13`:

```ts
export interface FlowpanelTypes {
  // empty — consumers augment
}

export type InferDB = FlowpanelTypes extends { db: infer D } ? D : unknown;
```

`InferDB` is `unknown` until you augment, then resolves to whatever you
set `db` to. Every framework-provided context type reads through
`InferDB`:

- `WidgetContext` (`packages/core/src/types/widget.ts`) — dashboard widget queries
- `ActionContext` (`packages/core/src/types/context.ts:50`) — row/bulk action `run`
- `ListQueryContext` / `ItemQueryContext` (`packages/core/src/types/context.ts`)
- The `Adapter<DB = InferDB>` generic (`packages/core/src/types/adapter.ts:23`)

So `db: InferDB` becomes `typeof db` automatically after augmentation —
no extra wiring per callback.

## Prisma example

```ts
import { PrismaClient } from "@prisma/client";
import { defineAdmin, resource } from "flowpanel";
import { prismaAdapter } from "flowpanel/prisma";

const prisma = new PrismaClient();

declare module "@flowpanel/core" {
  interface FlowpanelTypes {
    db: typeof prisma;
  }
}

export default defineAdmin({
  adapter: prismaAdapter({ prisma }),
  resources: [
    resource(prisma.user, {
      listQuery: async ({ db }) => {
        const users = await db.user.findMany({ take: 50 });
        return { rows: users, total: users.length, page: 1, pageSize: 50 };
      },
    }),
  ],
});
```

## Where to put the `declare module` block

Anywhere TypeScript will pick it up via your `tsconfig.json` `include`.
Three common spots:

1. **Top of `flowpanel.config.ts`** — the simplest, and what `flowpanel
   init` scaffolds. The block lives next to the `db` import it
   references.
2. A dedicated `types/flowpanel.d.ts` file — useful when the config is
   split across multiple files.
3. Inline in a `globals.d.ts` you already have for other module
   augmentations.

There's no precedence rule beyond standard TypeScript module
augmentation: every block contributes to the same interface; the last
one to write a given key wins.

## Why not codegen or generics?

- **No codegen step.** Augmentation needs zero build hooks. Run-of-the-
  mill `pnpm dev` re-types your config on file save.
- **No per-callback generic.** Threading `<DB>` through `resource`,
  `dashboard`, `metric`, `action` would balloon the public DSL.
  Augmentation centralizes the binding in one place.
- **The trade-off:** the inference is global — FlowPanel doesn't (yet)
  support different `db` types per resource. If you have two databases
  in one admin, type one of them via augmentation and cast the other
  inside the relevant `query` callback.

## See also

- [Resources](./resources.md) — full `ResourceOptions<Row>` shape
- [Dashboards](./dashboard.md) — `WidgetContext.db`
- [Adapters](./adapters.md) — Drizzle / Prisma adapter wiring

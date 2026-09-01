# @flowpanel/kit

> One typed config → full admin panel for your Next.js app. Drizzle or Prisma. Realtime. Queues. Eject when you outgrow it.

[![npm](https://img.shields.io/npm/v/%40flowpanel%2Fkit.svg)](https://www.npmjs.com/package/@flowpanel/kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/getflowpanel/flowpanel/blob/main/LICENSE)

## Install

```bash
pnpm dlx @flowpanel/cli init
pnpm flowpanel migrate
pnpm flowpanel dev
```

Visit `http://localhost:3000/admin`. Done.

## What you get

- **Type-safe end-to-end.** `ctx.db` typed everywhere via one `declare module` augmentation.
- **Three customization tiers.** L1 props → L2 `theme.components` overrides (10 slots) → L3 `flowpanel eject` for full ownership.
- **Batteries included.** CRUD lists, drawers, dashboards, BullMQ queues, realtime SSE, soft-delete, audit, scope, rate-limit.
- **Two ORMs first-class.** Drizzle (Postgres / MySQL / SQLite) and Prisma — `@flowpanel/kit/drizzle` and `@flowpanel/kit/prisma`.
- **Auth helpers.** `withClerk`, `withNextAuth`, `withLucia` from `@flowpanel/kit/auth`.

## The config

```ts
// flowpanel.config.ts
import { defineAdmin, resource } from "@flowpanel/kit";
import { drizzleAdapter } from "@flowpanel/kit/drizzle";
import { withClerk } from "@flowpanel/kit/auth";
import { db } from "@/server/lib/db";
import * as schema from "@/server/lib/db/schema";

declare module "@flowpanel/kit" {
  interface FlowpanelTypes { db: typeof db }
}

export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),
  auth: withClerk({ requireRole: "admin" }),
  resources: [resource(schema.users, { columns: ["email", "role"] })],
});
```

## CLI

```
flowpanel init      Scaffold the admin (config + routes + migrations)
flowpanel dev       Start Next.js (and bull-board when scripts/board-server.mts exists and REDIS_URL is set)
flowpanel new       Add a resource to flowpanel.config.ts
flowpanel migrate   Apply audit + tracking SQL migrations
flowpanel doctor    Health check (--fix to auto-write missing routes)
flowpanel eject     Take ownership of a resource / dashboard / layout
```

## Subpaths

```
@flowpanel/kit                 core builders (defineAdmin, resource, dashboard, ...)
@flowpanel/kit/next            Next.js App Router integration
@flowpanel/kit/next/client     Client components for the Next.js integration
@flowpanel/kit/react           React UI primitives (used internally and exposed)
@flowpanel/kit/drizzle         Drizzle adapter
@flowpanel/kit/prisma          Prisma adapter
@flowpanel/kit/bullmq          BullMQ queue adapter
@flowpanel/kit/bullmq/board    startBoardServer (mounts bull-board, kept Express-free from the adapter entry)
@flowpanel/kit/charts          Charts (lazy-loaded)
@flowpanel/kit/charts/runtime  Chart renderers (used internally by the lazy-loaded charts)
@flowpanel/kit/client          Client-only hooks
@flowpanel/kit/auth            withClerk, withNextAuth, withLucia
@flowpanel/kit/server          Server-only utilities
```

## Documentation

<https://flowpanel.tech>

## License

MIT — see [LICENSE](https://github.com/getflowpanel/flowpanel/blob/main/LICENSE).

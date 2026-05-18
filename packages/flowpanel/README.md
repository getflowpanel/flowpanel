# flowpanel

> One typed config → full admin panel for your Next.js app. Drizzle or Prisma. Realtime. Queues. Eject when you outgrow it.

[![npm](https://img.shields.io/npm/v/flowpanel.svg)](https://www.npmjs.com/package/flowpanel)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/Ch4m4/flowpanel/blob/main/LICENSE)

## Install

```bash
pnpm add flowpanel
pnpm flowpanel init
pnpm flowpanel dev
```

Visit `http://localhost:3000/admin`. Done.

## What you get

- **Type-safe end-to-end.** `ctx.db` typed everywhere via one `declare module` augmentation.
- **Three customization tiers.** L1 props (90%) → L2 `theme.components` overrides (10 slots) → L3 `flowpanel eject` for full ownership.
- **Batteries included.** CRUD lists, drawers, dashboards, BullMQ queues, realtime SSE, soft-delete, audit, scope, rate-limit.
- **Two ORMs first-class.** Drizzle (Postgres / MySQL / SQLite) and Prisma — `flowpanel/drizzle` and `flowpanel/prisma`.
- **Auth helpers.** `withClerk`, `withNextAuth`, `withLucia` from `flowpanel/auth`.

## 12-line config

```ts
// flowpanel.config.ts
import { defineAdmin, resource } from "flowpanel";
import { drizzleAdapter } from "flowpanel/drizzle";
import { withClerk } from "flowpanel/auth";
import { db } from "@/db/client";
import * as schema from "@/db/schema";

declare module "@flowpanel/core" {
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
flowpanel dev       Start Next.js (and bull-board if REDIS_URL is set)
flowpanel new       Add a resource to flowpanel.config.ts
flowpanel migrate   Apply audit + tracking SQL migrations
flowpanel doctor    Health check (--fix to auto-write missing routes)
flowpanel eject     Take ownership of a resource / dashboard / layout
```

## Subpaths

```
flowpanel              core builders (defineAdmin, resource, dashboard, ...)
flowpanel/next         Next.js App Router integration
flowpanel/react        React UI primitives (used internally and exposed)
flowpanel/drizzle      Drizzle adapter
flowpanel/prisma       Prisma adapter
flowpanel/bullmq       BullMQ queue adapter
flowpanel/charts       Charts (lazy-loaded)
flowpanel/client       Client-only hooks
flowpanel/auth         withClerk, withNextAuth, withLucia
flowpanel/server       Server-only utilities
```

## Documentation

<https://flowpanel.dev>

## License

MIT — see [LICENSE](https://github.com/Ch4m4/flowpanel/blob/main/LICENSE).

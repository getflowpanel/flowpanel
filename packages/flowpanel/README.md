# @flowpanel/kit

A typed admin panel for an existing Next.js App Router app, built from your Drizzle or Prisma schema and a typed config. It runs inside your app, with your database client and your auth. Everything FlowPanel runs in your app ships in this one package; the subpaths keep each part out of the bundles that do not use it.

## Install

```bash
pnpm dlx @flowpanel/cli init
pnpm dev
```

## Example

```ts
// flowpanel.config.ts
import { defineAdmin, resource } from "@flowpanel/kit";
import { withClerk } from "@flowpanel/kit/auth";
import { drizzleAdapter } from "@flowpanel/kit/drizzle";
import { db } from "@/server/lib/db";
import * as schema from "@/server/lib/db/schema";

export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),
  auth: withClerk({ access: "admin" }),
  resources: [resource(schema.users, { columns: ["email", "role"] })],
});
```

## Subpaths

| Import | What it holds |
| --- | --- |
| `@flowpanel/kit` | `defineAdmin`, resources, dashboards and every widget builder, chart builders included; no React, Next.js or ORM code |
| `@flowpanel/kit/next` | The App Router runtime: `createFlowpanel`, route handlers, `publish` and `emitAudit` |
| `@flowpanel/kit/drizzle` | The Drizzle adapter (`drizzle-orm` peer) |
| `@flowpanel/kit/prisma` | The Prisma adapter (`@prisma/client` peer) |
| `@flowpanel/kit/auth` | Presets for Better Auth, Auth.js, Clerk and Lucia |
| `@flowpanel/kit/react` | The UI components, for custom pages and slots |
| `@flowpanel/kit/client` | A typed client for the admin's HTTP API and `useAdminMutation`, without Next.js |
| `@flowpanel/kit/charts` | Chart components, drawn with Recharts |
| `@flowpanel/kit/bullmq` | The BullMQ queue adapter (`bullmq` peer) |
| `@flowpanel/kit/bullmq/board` | A standalone bull-board server (`express` and `@bull-board/*` peers) |
| `@flowpanel/kit/publish` | Realtime publishing from a worker, cron job or script, without the admin |
| `@flowpanel/kit/test` | `smokeAdmin` for Playwright (`@playwright/test` peer) |
| `@flowpanel/kit/test/widgets` | Widget unit tests under Vitest, without Playwright |
| `@flowpanel/kit/styles/admin.css` | The precompiled, isolated stylesheet |
| `@flowpanel/kit/styles/tailwind.css` | FlowPanel's tokens as Tailwind v4 theme values |

Every peer above is needed only when your app uses that subpath. The package ships `llms.txt`, the whole documentation as plain text, and `llms/`, one file per section.

[Documentation](https://flowpanel.tech/docs/introduction/getting-started) · MIT

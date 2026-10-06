# @flowpanel/kit

A typed admin panel for an existing Next.js App Router app, built from your Drizzle or Prisma schema and a typed config. It runs inside your app, with your database client and your auth. This package re-exports every FlowPanel package under subpaths such as `@flowpanel/kit/next`, `@flowpanel/kit/drizzle` and `@flowpanel/kit/auth`.

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
  auth: withClerk({ requireRole: "admin" }),
  resources: [resource(schema.users, { columns: ["email", "role"] })],
});
```

The package ships `llms.txt`, the whole documentation as plain text, and `llms/`, one file per section.

[Documentation](https://flowpanel.tech/docs/introduction/getting-started) · MIT

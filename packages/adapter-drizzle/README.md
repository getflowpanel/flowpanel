# @flowpanel/adapter-drizzle

The Drizzle ORM adapter for FlowPanel, for PostgreSQL, MySQL and SQLite. It reads columns and row types from your schema and runs queries and migrations through your `db` client. Apps use it as `@flowpanel/kit/drizzle`.

## Install

```bash
pnpm add @flowpanel/kit
```

## Example

```ts
import { defineAdmin } from "@flowpanel/kit";
import { drizzleAdapter } from "@flowpanel/kit/drizzle";
import { db } from "@/db/client";
import * as schema from "@/db/schema";

export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),
  auth,
  resources,
});
```

[Drizzle setup](https://flowpanel.tech/docs/introduction/drizzle) · MIT

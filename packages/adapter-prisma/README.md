# @flowpanel/adapter-prisma

The Prisma adapter for FlowPanel, for PostgreSQL, MySQL and SQLite. It reads model metadata from Prisma's DMMF at runtime and runs queries and migrations through your Prisma Client. Apps use it as `@flowpanel/kit/prisma`.

## Install

```bash
pnpm add @flowpanel/kit
```

## Example

```ts
import { defineAdmin, resource } from "@flowpanel/kit";
import { prismaAdapter } from "@flowpanel/kit/prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default defineAdmin({
  adapter: prismaAdapter({ prisma, provider: "postgresql" }),
  auth,
  resources: [resource("User", { columns: ["email", "role"] })],
});
```

[Prisma setup](https://flowpanel.tech/docs/introduction/prisma) · MIT

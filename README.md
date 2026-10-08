# FlowPanel

FlowPanel adds a typed admin panel to an existing Next.js app, built from your Drizzle or Prisma schema and a small config. It runs inside your app, with your database client and your auth.

<a href="examples/ai-scraper">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="examples/ai-scraper/public/scrapeai-overview-dark.png">
    <img alt="ScrapeAI overview in FlowPanel: four key figures, two of them compared with the previous week, a live crawl-rate chart and market activity" src="examples/ai-scraper/public/scrapeai-overview-light.png">
  </picture>
</a>

## Install

<!-- flowpanel:compatibility:start -->
| Requirement | Supported range |
| --- | --- |
| Node.js | `>=20` |
| Next.js | `>=15.5.0 <17.0.0` |
| React | `^19.0.0` |
| Drizzle ORM | `>=0.45.2 <1.0.0` |
| Prisma Client | `>=5.0.0 <7.0.0` |
<!-- flowpanel:compatibility:end -->

From the root of a Next.js App Router app:

```bash
pnpm dlx @flowpanel/cli init
pnpm dev
```

## Example

```ts
// flowpanel.config.ts
import { defineAdmin, resource } from "@flowpanel/kit";
import { withBetterAuth } from "@flowpanel/kit/auth";
import { drizzleAdapter } from "@flowpanel/kit/drizzle";
import { auth } from "@/lib/auth";
import { db } from "@/server/lib/db";
import * as schema from "@/server/lib/db/schema";

export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),
  auth: withBetterAuth({ auth, access: "admin" }),
  resources: [resource(schema.users, { columns: ["email", "name", "createdAt"], search: ["email"] })],
});
```

Open [http://localhost:3000/admin](http://localhost:3000/admin).

## Packages

| Package | What it is |
| --- | --- |
| [`@flowpanel/kit`](packages/flowpanel) | Everything that runs in your app: config builders, the Drizzle, Prisma and BullMQ adapters, the Next.js runtime, the UI, charts and test helpers, under subpaths |
| [`@flowpanel/cli`](packages/cli) | `init`, `new`, `doctor`, `migrate`, `dev` and `eject` |
| [`@flowpanel/eslint-plugin`](packages/eslint-plugin) | Optional lint rules for admin configs |

FlowPanel is pre-1.0: a minor release may change the API, and each one comes with an [upgrade guide](https://flowpanel.tech/docs/guides/upgrade).

## Links

- [Documentation](https://flowpanel.tech/docs/introduction/getting-started) and the [tutorial](https://flowpanel.tech/docs/introduction/founder-admin)
- [Live demo](https://demo.flowpanel.tech/admin) and its source, [`examples/ai-scraper`](examples/ai-scraper); a minimal Clerk setup in [`examples/with-clerk`](examples/with-clerk)
- [Changelog](https://flowpanel.tech/changelog) and [roadmap](ROADMAP.md)
- [Contributing](.github/CONTRIBUTING.md), [Discussions](https://github.com/getflowpanel/flowpanel/discussions), [Issues](https://github.com/getflowpanel/flowpanel/issues)
- [MIT license](LICENSE)

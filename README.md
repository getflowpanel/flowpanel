# FlowPanel

FlowPanel creates a typed admin interface inside an existing Next.js app from your Drizzle or Prisma schema and a small config.

[![npm](https://img.shields.io/npm/v/%40flowpanel%2Fkit.svg?color=blue)](https://www.npmjs.com/package/@flowpanel/kit)
[![CI](https://github.com/getflowpanel/flowpanel/actions/workflows/ci.yml/badge.svg)](https://github.com/getflowpanel/flowpanel/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[![ScrapeAI operations dashboard built with FlowPanel](examples/ai-scraper/public/scrapeai-overview-dark.png)](examples/ai-scraper)

[See the demo](https://flowpanel.tech) · [Read the docs](https://flowpanel.tech/docs/introduction/getting-started) · [View the changelog](https://flowpanel.tech/changelog)

## When FlowPanel fits

Use FlowPanel when your product already has a Next.js App Router application and a Drizzle or Prisma data layer, and you need an internal interface for CRUD, operational dashboards, actions, imports, queues, or live data. It stays in your repository, uses your database client and auth, and deploys with the host app.

FlowPanel is not a hosted database browser or a general React admin framework. It is a poor fit if you use the Pages Router, need a non-Next.js frontend, need an unsupported data source without writing an adapter, or want a no-code product managed outside your codebase.

## Requirements

<!-- flowpanel:compatibility:start -->
| Requirement | Supported range |
| --- | --- |
| Node.js | `>=20` |
| Next.js | `^16.3.0` |
| React | `^19.0.0` |
| Tailwind CSS | `^3.0.0 || ^4.0.0` |
| Drizzle ORM | `>=0.45.2 <1.0.0` |
| Prisma Client | `>=5.0.0 <7.0.0` |
<!-- flowpanel:compatibility:end -->

The App Router is required. Choose Drizzle or Prisma for the resource adapter. Redis and BullMQ are optional.

## Quick start

Run these commands from the root of an existing application:

```bash
pnpm dlx @flowpanel/cli init
pnpm flowpanel migrate
pnpm flowpanel dev
```

`init` detects the ORM, installs version-aligned packages, and creates the config, admin page, API and SSE routes, stylesheet, and first migration. It does not overwrite files it does not own. Use `--dry-run` to inspect the filesystem plan.

The generated config starts with no resources. Add one table or model:

```ts
import { defineAdmin, resource } from "@flowpanel/kit";
import { drizzleAdapter } from "@flowpanel/kit/drizzle";
import { db } from "@/server/lib/db";
import * as schema from "@/server/lib/db/schema";

export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),
  resources: [
    resource(schema.users, {
      columns: ["email", "name", "createdAt"],
      search: ["email", "name"],
    }),
  ],
});
```

Open [http://localhost:3000/admin](http://localhost:3000/admin). The [Getting started guide](https://flowpanel.tech/docs/introduction/getting-started) includes complete Drizzle and Prisma configs with authentication.

## Customize without a rewrite

Start with the smallest extension point that solves the problem:

1. Change labels, columns, fields, filters, actions, or layout in config.
2. Add a column renderer when one value needs a different presentation.
3. Build a custom widget or page for a composed workflow.
4. Replace a shared visual primitive through a theme slot.
5. Eject a resource, dashboard, or layout only when you need to own its source and behavior.

The [customization guide](https://flowpanel.tech/docs/customization/overview) explains what each layer can and cannot change.

## Learn FlowPanel

- [Getting started](https://flowpanel.tech/docs/introduction/getting-started) — reach a working first resource.
- [Build your admin](https://flowpanel.tech/docs/build/resources) — resources, forms, actions, drawers, and dashboards.
- [Customize the UI](https://flowpanel.tech/docs/customization/overview) — renderers, charts, styling, slots, and eject.
- [Production](https://flowpanel.tech/docs/guides/auth-with-clerk) — auth, permissions, scope, realtime, and queues.
- [Understand FlowPanel](https://flowpanel.tech/docs/understand/how-flowpanel-works) — adapters, lifecycle, inference, and server boundaries.
- [Reference](https://flowpanel.tech/docs/reference/define-config) — generated types, signatures, defaults, and CLI options.

## Examples

- [`examples/ai-scraper`](examples/ai-scraper) is the complete ScrapeAI demo with dashboards, resources, actions, roles, and realtime data.
- [`examples/with-clerk`](examples/with-clerk) is the smallest Clerk integration.

## Packages

| Package | Purpose |
| --- | --- |
| [`@flowpanel/kit`](packages/flowpanel) | Main package and public subpath exports |
| [`@flowpanel/cli`](packages/cli) | Project setup, migrations, diagnostics, generation, and eject |
| [`@flowpanel/adapter-drizzle`](packages/adapter-drizzle) | Drizzle resource adapter |
| [`@flowpanel/adapter-prisma`](packages/adapter-prisma) | Prisma resource adapter |
| [`@flowpanel/adapter-bullmq`](packages/adapter-bullmq) | BullMQ queue adapter and board integration |

Lower-level core, Next.js, React, charts, client, and ESLint packages are available for advanced integrations. All workspace packages are released together while FlowPanel is pre-1.0.

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md). Questions and design ideas belong in [GitHub Discussions](https://github.com/getflowpanel/flowpanel/discussions); reproducible bugs belong in [Issues](https://github.com/getflowpanel/flowpanel/issues).

## License

[MIT](LICENSE) © FlowPanel contributors

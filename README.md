# FlowPanel

Config-driven admin panel for Node.js pipelines. Describe your pipeline once — get a production-ready dashboard with real-time updates, metrics, and error tracking.

[![npm](https://img.shields.io/npm/v/@flowpanel/core)](https://www.npmjs.com/package/@flowpanel/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/Ch4m4/flowpanel/actions/workflows/ci.yml/badge.svg)](https://github.com/Ch4m4/flowpanel/actions/workflows/ci.yml)

## Why FlowPanel

- **Zero UI code** — define stages, metrics, and columns in config. FlowPanel renders the dashboard.
- **Real-time** — SSE live updates via pg_notify. See runs complete as they happen.
- **Production-ready** — auth, rate limiting, audit log, row-level security out of the box.

## Quick Start

### With Drizzle ORM

```bash
npm install @flowpanel/core @flowpanel/react @flowpanel/adapter-drizzle
npx flowpanel init
npx flowpanel migrate
```

```ts
import { defineFlowPanel, z } from "@flowpanel/core";
import { drizzleAdapter } from "@flowpanel/adapter-drizzle";
import { db } from "./db";

export const flowpanel = defineFlowPanel({
  appName: "my-pipeline",
  adapter: drizzleAdapter({ db }),
  pipeline: {
    stages: ["ingest", "process", "deliver"] as const,
    fields: { tokens: z.number(), cost: z.number() },
  },
});
```

### With Prisma

```bash
npm install @flowpanel/core @flowpanel/react @flowpanel/adapter-prisma
npx flowpanel init
npx flowpanel migrate
```

```ts
import { defineFlowPanel, z } from "@flowpanel/core";
import { prismaAdapter } from "@flowpanel/adapter-prisma";
import { prisma } from "./db";

export const flowpanel = defineFlowPanel({
  appName: "my-pipeline",
  adapter: prismaAdapter({ prisma }),
  pipeline: {
    stages: ["ingest", "process", "deliver"] as const,
    fields: { tokens: z.number(), cost: z.number() },
  },
});
```

## Packages

| Package | Description |
|---------|-------------|
| [`@flowpanel/core`](packages/core) | Config schema, tRPC router, SSE broker, query builder |
| [`@flowpanel/react`](packages/react) | `<FlowPanelUI>` and all dashboard components |
| [`@flowpanel/cli`](packages/cli) | CLI for init, migrate, doctor, diff, demo |
| [`@flowpanel/adapter-drizzle`](packages/adapter-drizzle) | Drizzle ORM adapter |
| [`@flowpanel/adapter-prisma`](packages/adapter-prisma) | Prisma adapter |

## CLI Commands

| Command | Description |
|---------|-------------|
| `flowpanel init` | Scaffold config and admin page |
| `flowpanel migrate` | Apply database migrations |
| `flowpanel migrate:status` | Show migration status |
| `flowpanel doctor` | Health check for config, DB, auth |
| `flowpanel diff` | Show config vs DB drift |
| `flowpanel demo` | Seed demo runs |
| `flowpanel status` | Quick status overview |
| `flowpanel dev` | Watch config with live validation |

## Documentation

Full documentation: [https://flowpanel.tech/docs](https://flowpanel.tech/docs)

## License

[MIT](LICENSE)

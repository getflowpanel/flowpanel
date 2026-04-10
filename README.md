# FlowPanel

Config-driven admin panel for Node.js pipelines. Describe your pipeline once — get a production-ready dashboard with real-time updates, metrics, and error tracking.

[![npm](https://img.shields.io/npm/v/@flowpanel/core)](https://www.npmjs.com/package/@flowpanel/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Quick Start

```bash
# 1. Install
pnpm add @flowpanel/core @flowpanel/react @flowpanel/adapter-drizzle

# 2. Initialize
npx flowpanel init

# 3. Run migrations
npx flowpanel migrate

# 4. Open dashboard
npx flowpanel dev
```

## Why FlowPanel

- **Zero UI code** — define stages, metrics, and columns in config. FlowPanel renders the dashboard.
- **Real-time** — SSE live updates via pg_notify. See runs complete as they happen.
- **Production-ready** — auth, rate limiting, audit log, row-level security out of the box.

## Packages

| Package | Description |
|---------|-------------|
| `@flowpanel/core` | Config schema, tRPC router, SSE broker, query builder |
| `@flowpanel/react` | `<FlowPanelUI>` and all dashboard components |
| `@flowpanel/cli` | CLI for init, migrate, doctor, diff, demo |
| `@flowpanel/adapter-drizzle` | Drizzle ORM adapter |
| `@flowpanel/adapter-prisma` | Prisma adapter |

## Config Example

```ts
import { defineFlowPanel, z } from "@flowpanel/core";
import { drizzleAdapter } from "@flowpanel/adapter-drizzle";

export const flowpanel = defineFlowPanel({
  appName: "my-pipeline",
  adapter: drizzleAdapter({ db: () => import("./db").then(m => m.db) }),
  pipeline: {
    stages: ["ingest", "process", "deliver"] as const,
    fields: { tokens: z.number(), cost: z.number() },
  },
  metrics: {
    totalRuns: { label: "Total Runs", query: "count", format: "number" },
    successRate: { label: "Success Rate", query: "successRate", format: "percent" },
  },
});
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `flowpanel init` | Scaffold config and admin page |
| `flowpanel migrate` | Apply database migrations |
| `flowpanel doctor` | Health check for config, DB, auth |
| `flowpanel diff` | Show config vs DB drift |
| `flowpanel demo` | Seed 500 demo runs |
| `flowpanel status` | Quick status overview |
| `flowpanel dev` | Watch config with live validation |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)

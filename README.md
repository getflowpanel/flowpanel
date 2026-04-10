<p align="center">
  <img src="docs/assets/preview.png" width="720" alt="FlowPanel Dashboard" />
</p>

<h1 align="center">FlowPanel</h1>
<p align="center">
  Beautiful admin dashboard for data pipelines. Zero-config defaults, full customization.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#why-flowpanel">Why FlowPanel</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#cli">CLI</a>
</p>

---

## Quick Start

```bash
npm install @flowpanel/core @flowpanel/react @flowpanel/adapter-prisma
npx flowpanel init
```

Then start your dev server and visit `/admin`.

## Why FlowPanel

- **Constructor architecture** — metrics, drawers, stages, columns — all declarative config
- **Real-time** — SSE streaming with automatic fallback to polling
- **Beautiful by default** — dark theme, keyboard shortcuts, accessibility-first
- **Type-safe** — Zod config validation, TypeScript throughout
- **Adapter pattern** — Prisma or Drizzle, PostgreSQL or SQLite

## Packages

| Package | Description |
|---------|-------------|
| `@flowpanel/core` | Core logic, tRPC router, config schema, query builder |
| `@flowpanel/react` | React UI components — dashboard, charts, drawers |
| `@flowpanel/cli` | CLI tools — init, migrate, doctor, dev |
| `@flowpanel/adapter-drizzle` | Drizzle ORM adapter |
| `@flowpanel/adapter-prisma` | Prisma adapter |
| `@flowpanel/locale-ru` | Russian locale |

## Configuration

```ts
import { defineFlowPanel } from "@flowpanel/core";
import { prismaAdapter } from "@flowpanel/adapter-prisma";

export default defineFlowPanel({
  appName: "My App",
  adapter: prismaAdapter({ prisma }),
  pipeline: {
    stages: ["ingest", "process", "notify"],
  },
  metrics: {
    totalRuns: {
      label: "Total Runs",
      query: (qb) => qb.count(),
      format: "number",
      trend: "vs-previous-period",
    },
  },
  drawers: {
    "run-detail": {
      title: (run) => `Run #${run.id}`,
      sections: [
        { type: "stat-grid", stats: ["status", "duration_ms", "stage"] },
        { type: "timeline" },
        { type: "kv-grid", fields: ["partition_key", "created_at"] },
        { type: "error-block", when: (run) => run.status === "failed" },
      ],
    },
  },
  security: {
    auth: { getSession: async (req) => getServerSession(req) },
  },
});
```

## Drawers — LEGO Blocks

Drawers are composable. Pick section types and assemble:

| Section Type | What It Shows |
|-------------|---------------|
| `stat-grid` | Grid of stat cards (status, duration, stage) |
| `kv-grid` | Key-value pairs with copy buttons |
| `timeline` | Execution step breakdown with timing bars |
| `trend-chart` | Mini area chart |
| `breakdown` | Horizontal proportional bars |
| `error-list` | Top errors with count badges |
| `error-block` | Error message with expandable stack trace |

## CLI

```
flowpanel init         Scaffold config, routes, and first migration
flowpanel dev          Watch config for changes, auto-validate
flowpanel migrate      Apply pending migrations
flowpanel migrate:gen  Generate migration from config diff
flowpanel doctor       Health check: auth, schema, indexes, security
flowpanel diff         Show config vs DB schema drift
flowpanel demo         Seed 500 realistic demo runs
flowpanel demo:clear   Remove seeded demo data
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `⌘K` | Command palette |
| `?` | Keyboard shortcuts help |
| `j/k` | Navigate run table |
| `Enter` | Open run detail |
| `1/2/3` | Switch tabs |
| `Esc` | Close drawer/palette |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT

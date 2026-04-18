# @flowpanel/core

Core package for FlowPanel. Provides `defineFlowPanel()`, `withRun()`, config schema (Zod), tRPC router, and SSE broker.

[![npm](https://img.shields.io/npm/v/@flowpanel/core)](https://www.npmjs.com/package/@flowpanel/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/Ch4m4/flowpanel/blob/main/LICENSE)

## Installation

```bash
npm install @flowpanel/core
```

Requires a database adapter:

```bash
npm install @flowpanel/adapter-drizzle
# or
npm install @flowpanel/adapter-prisma
```

## Usage

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
  metrics: {
    totalRuns: { label: "Total Runs", query: "count", format: "number" },
    successRate: { label: "Success Rate", query: "successRate", format: "percent" },
  },
});
```

Track a pipeline run with `withRun()`:

```ts
await flowpanel.withRun("ingest", { partitionKey: userId }, async (run) => {
  run.set({ tokens: 1200, cost: 0.004 });
  await processData();
});
```

## Documentation

[https://flowpanel.tech/docs/core](https://flowpanel.tech/docs/core)

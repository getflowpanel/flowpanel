# @flowpanel/adapter-drizzle

Drizzle ORM adapter for FlowPanel.

[![npm](https://img.shields.io/npm/v/@flowpanel/adapter-drizzle)](https://www.npmjs.com/package/@flowpanel/adapter-drizzle)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/Ch4m4/flowpanel/blob/main/LICENSE)

## Installation

```bash
npm install @flowpanel/adapter-drizzle
```

## Usage

```ts
import { defineFlowPanel } from "@flowpanel/core";
import { drizzleAdapter } from "@flowpanel/adapter-drizzle";
import { db } from "./db";

export const flowpanel = defineFlowPanel({
  appName: "my-pipeline",
  adapter: drizzleAdapter({ db }),
  // ...
});
```

Pass a lazy initializer if `db` is not available at module load time:

```ts
adapter: drizzleAdapter({ db: () => import("./db").then((m) => m.db) })
```

## Documentation

[https://flowpanel.tech/docs/adapters/drizzle](https://flowpanel.tech/docs/adapters/drizzle)

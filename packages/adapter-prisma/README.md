# @flowpanel/adapter-prisma

Prisma adapter for FlowPanel.

[![npm](https://img.shields.io/npm/v/@flowpanel/adapter-prisma)](https://www.npmjs.com/package/@flowpanel/adapter-prisma)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/Ch4m4/flowpanel/blob/main/LICENSE)

## Installation

```bash
npm install @flowpanel/adapter-prisma
```

## Usage

```ts
import { defineFlowPanel } from "@flowpanel/core";
import { prismaAdapter } from "@flowpanel/adapter-prisma";
import { prisma } from "./db";

export const flowpanel = defineFlowPanel({
  appName: "my-pipeline",
  adapter: prismaAdapter({ prisma }),
  // ...
});
```

Requires `DATABASE_URL` environment variable for advisory lock support.

## Documentation

[https://flowpanel.tech/docs/adapters/prisma](https://flowpanel.tech/docs/adapters/prisma)

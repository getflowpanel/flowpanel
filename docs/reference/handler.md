# `createFlowPanelHandler`

Next.js App Router mount for FlowPanel. Replaces the 30-line tRPC boilerplate
with a single call.

## Usage

```ts
// app/api/trpc/[trpc]/route.ts
import { createFlowPanelHandler } from "@flowpanel/core";
import { flowpanel } from "@/src/flowpanel";

const handler = createFlowPanelHandler(flowpanel);

export const { GET, POST } = handler;
export type AppRouter = typeof handler.router;
```

The client imports `AppRouter` the same way as with a hand-rolled tRPC setup:

```ts
// src/trpc.ts
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/app/api/trpc/[trpc]/route";

export const trpc = createTRPCReact<AppRouter>();
```

## Options

```ts
createFlowPanelHandler(flowpanel, {
  endpoint: "/admin/trpc",          // default "/api/trpc"
  onError: (err) => reportError(err),
});
```

| Option     | Type                    | Default      | Description                                      |
| ---------- | ----------------------- | ------------ | ------------------------------------------------ |
| `endpoint` | `string`                | `"/api/trpc"` | Route prefix — must match your Next.js route dir.|
| `onError`  | `(err: unknown) => void`| —            | Called for every uncaught error.                 |

## When to roll your own

Reach for `createFlowPanelRouter` directly (exported from
`@flowpanel/core/trpc`) if you need:

- a custom tRPC context beyond `{ req }`
- a non-fetch transport (Express, Fastify, SSE-only)
- multiple routers composed at the top level

The handler is strictly the boilerplate shortcut; it does not hide anything
`createFlowPanelRouter` doesn't already do.

## `flowpanel doctor --boundary-check`

Run after adding the handler to catch accidental server-config imports from
client code:

```
$ pnpm flowpanel doctor --boundary-check
  ✓ Server/client boundary  src/flowpanel.ts is server-only; no client imports
```

The checker walks your repo looking for files with `"use client"` (or a
`.client.ts`/`.client.tsx` suffix) and reports any transitive import chain
that reaches the FlowPanel config. It also verifies the config starts with
`import "server-only"` — the standard Next.js guard.

False positives are possible for computed paths and re-exports through
barrel files that hide their source. For those, add `"server-only"` to the
intermediate file.

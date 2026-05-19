---
title: 'Next.js handlers'
description: 'FlowPanel mounts on a Next.js App Router app via two route handlers exported from @flowpanel/next.'
---


FlowPanel mounts on a Next.js App Router app via two route handlers
exported from `@flowpanel/next`:

| Export | Purpose |
|---|---|
| `handlers(config)` | The catch-all REST endpoint. Today serves drawer GETs and drawer-action POSTs. |
| `stream(config)` | The SSE endpoint for realtime channel subscriptions. |

> **WIP — there is no `createFlowPanelHandler` / `createFlowPanelRouter`
> tRPC factory.** FlowPanel does not expose a tRPC router as part of
> its public surface today; the runtime is built on Next.js Server
> Actions + plain route handlers + SSE.

## Mount the catch-all route

```ts
// app/api/flowpanel/[...route]/route.ts
import { handlers } from "@flowpanel/next";
import { flowpanel } from "@/src/flowpanel";

export const { GET, POST } = handlers(flowpanel);
```

Routes (relative to `/api/flowpanel/`):

| Method | Path | Handler |
|---|---|---|
| `GET` | `drawer/<resource>/<id>` | Drawer payload (fields, tabs, actions, …) |
| `POST` | `drawer/<resource>/<id>/actions/<action>` | Drawer action runner |

Anything else returns `404`. Server Actions for resource create / update
/ delete from the auto-form pages do **not** route through here — they
use Next.js Server Actions directly. Source:
`packages/next/src/handlers.ts:20`.

## Mount the SSE route

```ts
// app/api/flowpanel/stream/route.ts
import { stream } from "@flowpanel/next";
import { flowpanel } from "@/src/flowpanel";

export const GET = stream(flowpanel);
```

Source: `packages/next/src/stream.ts:10`.

`stream()` accepts an options object:

```ts
stream(flowpanel, { heartbeatMs: 15_000 });
```

| Option | Type | Default | Description |
|---|---|---|---|
| `heartbeatMs` | `number` | `15000` | Interval between SSE keep-alive comments. |

The endpoint reads `?channel=` query parameters, subscribes to each via
the runtime publisher, and writes SSE `message` frames to the client.
Aborted requests release their subscriptions.

## Health check — `flowpanel doctor`

```
$ pnpm flowpanel doctor
```

The CLI checks that the route files, server-only marker, and config are
wired (`packages/cli/src/commands/doctor.ts:157`). Pass `--fix` to
scaffold any missing route files from templates. There is no
`--boundary-check` flag today.

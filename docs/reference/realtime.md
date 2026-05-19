# Realtime

FlowPanel ships a pub/sub abstraction with two drivers: an in-process
**memory** publisher (default) and **Redis** pub/sub. Server code
publishes on a channel; the SSE handler at `/api/flowpanel/stream`
forwards messages to subscribed browsers as Server-Sent Events.

> **WIP — Postgres `LISTEN/NOTIFY` is not implemented.** The publisher
> drivers are `"memory"` and `"redis"` (`packages/core/src/runtime/publish.ts:6`).

## Configure the publisher

```ts
defineAdmin({
  ...,
  realtime: { driver: "memory" },                              // default for dev
  // or
  realtime: { driver: "redis", url: process.env.REDIS_URL!, keyPrefix: "fp:" },
});
```

Type: `RealtimeConfig` re-exports `PublisherOptions`
(`packages/core/src/types/realtime.ts:3`,
`packages/core/src/runtime/publish.ts:6`):

```ts
type PublisherOptions =
  | { driver: "memory" }
  | { driver: "redis"; url: string; keyPrefix?: string };
```

`ioredis` is loaded lazily — install it only if you pick `"redis"`
(`packages/core/src/runtime/publish.ts:54`).

## Opt a resource into realtime

```ts
resource(schema.users, {
  realtime: true,             // publishes "resource.users" on every mutation
});
```

Or pin a custom channel name:

```ts
resource(schema.users, { realtime: "users.live" });
```

(`packages/core/src/types/resource.ts:151`).

The runtime calls `publishResource(name, { action, id? })` after every
successful create/update/delete handled through the resource path
(`packages/next/src/runtime/publish.ts:37`). Channel format is
`resource.<name>`, payload is `{ action: "create" | "update" | "delete";
id?: string }`.

## Wire the SSE endpoint

```ts
// app/api/flowpanel/stream/route.ts
import { stream } from "@flowpanel/next";
import { flowpanel } from "@/src/flowpanel";

export const GET = stream(flowpanel);
```

(`packages/next/src/stream.ts:10`). The handler reads `?channel=`
parameters from the request URL, subscribes to each, and writes SSE
`message` frames as payloads come in. A `: keep-alive` comment fires
every 15s to defeat proxy buffering.

## Publishing from action handlers

`ActionContext.publish(channel, payload?)` is wired to the same
publisher (`packages/core/src/types/context.ts:52`). Use it from row /
bulk action `run` callbacks to publish on additional channels:

```ts
run: async (row, _input, ctx) => {
  await ctx.publish("resource.users", { action: "update", id: String(row.id) });
  return { ok: true };
}
```

Server-side code outside an action context can use the package-local
helpers from `@flowpanel/next`:

```ts
import { publish, publishResource } from "@flowpanel/next";

await publishResource("users", { action: "update", id: "abc" });
await publish("custom.channel", { hello: "world" });
```

(`packages/next/src/runtime/publish.ts`).

## Widget-level subscriptions

Dashboard widgets (`metric`, `table`, charts, custom) accept a
`realtime: string | string[]` option that the client uses to invalidate
the widget when those channels publish. See `dashboard.md`.

## Channel naming

The only channel the runtime publishes on automatically is
`resource.<name>`. You can publish on any string from your own code.
There is no Postgres `NOTIFY` integration, no `run.created/finished/failed`
events, no `metrics.updated` channel — those are not implemented today.

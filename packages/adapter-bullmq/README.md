# @flowpanel/adapter-bullmq

BullMQ queue adapter for FlowPanel — wraps `bull-board` behind a required shared-secret token
and integrates it into the admin nav.

[![npm](https://img.shields.io/npm/v/@flowpanel/adapter-bullmq.svg)](https://www.npmjs.com/package/@flowpanel/adapter-bullmq)

> Most users import from **`@flowpanel/kit/bullmq`** (umbrella subpath).

## Use

Register queues in `flowpanel.config.ts`:

```ts
import { queue } from "@flowpanel/kit";
import { Queue } from "bullmq";

const scraperQueue = new Queue("scraper", { connection: { host: "localhost", port: 6379 } });

export default defineAdmin({
  // ...
  queues: [
    queue(scraperQueue, {
      label: "Scraper",
      // `?token=` must match the `auth.token` passed to `startBoardServer` below.
      boardUrl: "http://localhost:3001/queue/scraper?token=YOUR_SHARED_SECRET",
    }),
  ],
});
```

Mount bull-board on a separate port via `startBoardServer`, exported from the
`/board` subpath so that the adapter entry stays free of Express. `auth.token`
is **required** — `startBoardServer` throws without it:

```ts
// scripts/board-server.mts
import { startBoardServer } from "@flowpanel/adapter-bullmq/board";
import { queues } from "@/lib/queues";

startBoardServer({ queues, port: 3001, auth: { token: process.env.BOARD_TOKEN! } });
```

Run with `pnpm flowpanel dev` (which auto-starts the board if `REDIS_URL` is set and `scripts/board-server.mts` exists), or directly via `tsx scripts/board-server.mts`.

## How it works

- `queue()` builder registers a queue in `ResolvedAdminConfig.queuesByKey`
- FlowPanel renders an iframe at `/admin/queues/<key>` pointing at the bull-board URL
- FlowPanel's `requireRole` gates who can load *that iframe page* in the admin —
  it does not protect the bull-board server itself, which listens on its own port

## What's actually protected, and what isn't

`startBoardServer` **does**:

- bind to `127.0.0.1` by default (not reachable from outside the machine unless
  you set `bindHost: "0.0.0.0"` yourself)
- require every request to bull-board (including retry / remove / drain job
  controls) to present the shared-secret `auth.token`, via an `Authorization:
  Bearer <token>` header or a `?token=` query param, checked with a
  constant-time comparison
- mint an `HttpOnly` session cookie (scoped to the board's base path) once a
  valid token is presented; the cookie authorizes subsequent requests, so the
  board SPA's scripts, styles, and `/api/queues` polls work without carrying
  `?token=` themselves

`startBoardServer` does **not**:

- give you per-user auth, roles, or an audit trail — `auth.token` is one static
  shared secret, equivalent to an API key, not a session or identity
- protect you if you set `bindHost: "0.0.0.0"` (or otherwise expose the port,
  e.g. via a container/firewall rule) without also putting a real
  auth-aware reverse proxy in front of it
- rotate the token for you — treat a leaked token like a leaked API key and
  replace it

## Peer dependencies

- `bullmq >= 5`
- `ioredis` (transitively via bullmq)
- `express >= 4.19`, `@bull-board/api >= 6`, `@bull-board/express >= 6` —
  optional, install them only if you import `@flowpanel/adapter-bullmq/board`
  (or `@flowpanel/kit/bullmq/board`)

## Documentation

<https://flowpanel.tech>

## License

MIT

# @flowpanel/adapter-bullmq

BullMQ queue adapter for FlowPanel — wraps `bull-board` with proper auth + theming integration.

[![npm](https://img.shields.io/npm/v/@flowpanel/adapter-bullmq.svg)](https://www.npmjs.com/package/@flowpanel/adapter-bullmq)

> Most users import from **`flowpanel/bullmq`** (umbrella subpath).

## Use

Register queues in `flowpanel.config.ts`:

```ts
import { queue } from "flowpanel";
import { Queue } from "bullmq";

const scraperQueue = new Queue("scraper", { connection: { host: "localhost", port: 6379 } });

export default defineAdmin({
  // ...
  queues: [
    queue(scraperQueue, { label: "Scraper", boardUrl: "http://localhost:3001/queues/scraper" }),
  ],
});
```

Mount bull-board on a separate port via `startBoardServer`:

```ts
// scripts/board-server.ts
import { startBoardServer } from "@flowpanel/adapter-bullmq";
import { queues } from "@/lib/queues";

startBoardServer({ queues, port: 3001 });
```

Run with `pnpm flowpanel dev` (which auto-starts the board if `REDIS_URL` is set and `scripts/board-server.ts` exists), or directly via `tsx scripts/board-server.ts`.

## How it works

- `queue()` builder registers a queue in `ResolvedAdminConfig.queuesByKey`
- FlowPanel renders an iframe at `/admin/queues/<key>` pointing at the bull-board URL
- Auth + role checks run before the iframe page renders

## Peer dependencies

- `bullmq >= 5`
- `ioredis` (transitively via bullmq)

## Documentation

<https://flowpanel.dev>

## License

MIT

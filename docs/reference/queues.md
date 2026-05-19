# Queues

Today FlowPanel ships a **BullMQ** integration in
`@flowpanel/adapter-bullmq`. The admin embeds the [bull-board](https://github.com/felixmosh/bull-board)
UI for each registered queue; it does not implement its own job
inspector.

> **WIP — generic `QueueAdapter` interface (pgmq, SQS, etc.) is not
> implemented.** Only BullMQ is supported.

## Setup

```bash
pnpm add @flowpanel/adapter-bullmq bullmq
```

```ts
import { Queue } from "bullmq";
import { defineAdmin, queue } from "flowpanel";
import { startBoardServer } from "@flowpanel/adapter-bullmq";

const scraperQueue = new Queue("scraper", { connection: { host: "localhost", port: 6379 } });
const emailQueue   = new Queue("emails",  { connection: { /* ... */ } });

// Mount the bull-board UI on a separate port (run alongside Next.js).
await startBoardServer({
  queues: { scraper: scraperQueue, emails: emailQueue },
  port: 3001,
});

export default defineAdmin({
  ...,
  queues: [
    queue(scraperQueue, { label: "Scraper", boardUrl: "http://localhost:3001/queues/scraper" }),
    queue(emailQueue,   { label: "Emails",  boardUrl: "http://localhost:3001/queues/emails"  }),
  ],
});
```

`queue()` lives at `packages/core/src/builders/queue.ts:11`.
`startBoardServer` is exported from `@flowpanel/adapter-bullmq`
(`packages/adapter-bullmq/src/index.ts:2`).

## `QueueOptions`

`packages/core/src/types/queue.ts:1`:

| Field | Type | Notes |
|---|---|---|
| `label` | `string` | Required. Sidebar label. |
| `boardUrl` | `string` | Required. Full URL to this queue's bull-board page. |
| `key` | `string` | Optional. Defaults to `queue.name`. |
| `requireRole` | `string \| string[]` | Optional role gate for the queue page. |

## What renders

Each queue gets a sidebar entry under "Queues" leading to
`/admin/queues/<key>`. The page embeds the bull-board UI at `boardUrl`
in an iframe — pause/resume/drain/retry/remove are handled by
bull-board, not by FlowPanel.

## `bullmqAdapter` helper (optional)

```ts
import { bullmqAdapter } from "@flowpanel/adapter-bullmq";

const adapter = bullmqAdapter({ scraper: scraperQueue, emails: emailQueue });
// adapter.queues.scraper === scraperQueue
```

Defined at `packages/adapter-bullmq/src/adapter.ts:17`. It's a thin
record wrapper, useful for passing the queue map around with a typed
shape.

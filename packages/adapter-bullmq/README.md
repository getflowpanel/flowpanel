# @flowpanel/adapter-bullmq

BullMQ queues in FlowPanel: a navigation entry per queue that embeds bull-board, and `startBoardServer`, which serves the board behind a required token. Apps use it as `@flowpanel/kit/bullmq` and `@flowpanel/kit/bullmq/board`.

## Install

```bash
pnpm add bullmq ioredis @bull-board/api @bull-board/express express
```

## Example

```ts
// scripts/board-server.mts
import { startBoardServer } from "@flowpanel/kit/bullmq/board";
import { queues } from "@/lib/queues";

startBoardServer({
  queues,
  port: 3001,
  bindHost: "127.0.0.1",
  auth: { token: process.env.BOARD_TOKEN! },
});
```

The token is one shared secret. Keep the board on a private network or behind an authenticating proxy.

[Queues](https://flowpanel.tech/docs/guides/queues) · MIT

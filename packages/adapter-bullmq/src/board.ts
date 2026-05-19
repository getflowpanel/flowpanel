import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter as BullBoardMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import type { Queue } from "bullmq";
import express from "express";
import type { Server } from "node:http";

export interface StartBoardServerOptions {
  queues: Record<string, Queue>;
  /** Default 3001. */
  port?: number;
  /** Path the Express app is mounted at. Default '/'. */
  basePath?: string;
}

/**
 * Start a bull-board Express server on its own port. Run from a Node script:
 *
 * ```ts
 * import { startBoardServer } from "@flowpanel/adapter-bullmq";
 * import { queues } from "./queues.js";
 * startBoardServer({ queues, port: 3001 });
 * ```
 *
 * In your admin config, point each `queue()` entry's `boardUrl` at
 * `http://localhost:3001/<subpath>` (bull-board auto-routes per queue).
 */
export function startBoardServer(opts: StartBoardServerOptions): Server {
  const app = express();
  const basePath = opts.basePath ?? "/";
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(basePath);

  createBullBoard({
    queues: Object.values(opts.queues).map((q) => new BullBoardMQAdapter(q)),
    serverAdapter,
  });

  app.use(basePath, serverAdapter.getRouter());

  const port = opts.port ?? 3001;
  return app.listen(port);
}

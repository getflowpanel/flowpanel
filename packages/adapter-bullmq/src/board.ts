import { timingSafeEqual } from "node:crypto";
import type { Server } from "node:http";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter as BullBoardMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import type { Queue } from "bullmq";
import express, { type NextFunction, type Request, type Response } from "express";

export interface StartBoardServerOptions {
  queues: Record<string, Queue>;
  /** Default 3001. */
  port?: number;
  /** Path the Express app is mounted at. Default '/'. */
  basePath?: string;
  /** Host interface to bind. */
  bindHost?: string;
  /** Required shared secret. */
  auth: { token: string };
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function requireToken(token: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.header("authorization");
    const headerToken = header?.toLowerCase().startsWith("bearer ")
      ? header.slice("bearer ".length)
      : undefined;
    const queryToken = typeof req.query.token === "string" ? req.query.token : undefined;
    const provided = headerToken ?? queryToken;
    if (!provided || !timingSafeEqualStrings(provided, token)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    next();
  };
}

/** Start a bull-board Express server on its own port. */
export function startBoardServer(opts: StartBoardServerOptions): Server {
  const token = opts.auth?.token;
  if (!token) {
    throw new Error(
      "startBoardServer: `auth.token` is required — bull-board has no auth of its own and " +
        "exposes destructive job controls (retry / remove / drain). Pass a long, random shared " +
        "secret via `auth: { token }` and append it as `?token=` to every `boardUrl`.",
    );
  }

  const app = express();
  const basePath = opts.basePath ?? "/";
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(basePath);

  createBullBoard({
    queues: Object.values(opts.queues).map((q) => new BullBoardMQAdapter(q)),
    serverAdapter,
  });

  app.use(basePath, requireToken(token), serverAdapter.getRouter());

  const port = opts.port ?? 3001;
  const bindHost = opts.bindHost ?? "127.0.0.1";
  return app.listen(port, bindHost);
}

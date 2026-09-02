import { createHmac, timingSafeEqual } from "node:crypto";
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

const SESSION_COOKIE = "flowpanel_board_session";
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

// Derived, not the raw token: the shared secret never lands in a cookie jar, and the value
// still validates across restarts and replicas without server-side session state.
function sessionValue(token: string): string {
  return createHmac("sha256", token).update(SESSION_COOKIE).digest("hex");
}

function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

function readToken(req: Request): string | undefined {
  const header = req.header("authorization");
  const headerToken = header?.toLowerCase().startsWith("bearer ")
    ? header.slice("bearer ".length)
    : undefined;
  const queryToken = typeof req.query.token === "string" ? req.query.token : undefined;
  return headerToken ?? queryToken;
}

/**
 * The board is a SPA: only its document URL carries `?token=`, its scripts, styles and
 * `/api/queues` polls do not. A valid token mints a session cookie that authorizes the rest.
 */
function requireToken(token: string, basePath: string) {
  const session = sessionValue(token);
  return (req: Request, res: Response, next: NextFunction) => {
    const cookie = readCookie(req, SESSION_COOKIE);
    if (cookie && timingSafeEqualStrings(cookie, session)) {
      next();
      return;
    }
    const provided = readToken(req);
    if (!provided || !timingSafeEqualStrings(provided, token)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    res.cookie(SESSION_COOKIE, session, {
      httpOnly: true,
      sameSite: "lax",
      secure: req.protocol === "https",
      path: basePath,
      maxAge: SESSION_MAX_AGE_MS,
    });
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

  app.use(basePath, requireToken(token, basePath), serverAdapter.getRouter());

  const port = opts.port ?? 3001;
  const bindHost = opts.bindHost ?? "127.0.0.1";
  return app.listen(port, bindHost);
}

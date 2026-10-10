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
  /** Checks the admin's signed links (and a proxy's Bearer); a list lets the secret rotate, the first signs. */
  auth: { secret: string | readonly string[] };
  /**
   * How many proxies in front of the board append `X-Forwarded-Proto`, as in the admin's
   * `security.trustedProxies`. With one, the session cookie is `Secure` behind a TLS-terminating proxy.
   * @defaultValue 0
   */
  trustedProxies?: number;
}

const SESSION_COOKIE = "flowpanel_board_session";
const SESSION_TTL_SECONDS = 60 * 60;
const LINK_PARAM = "fp_board";
/** Set by the board itself for bull-board's visibility guard; a client's own value is dropped. */
const SCOPE_HEADER = "x-flowpanel-board-queues";
const EVERY_QUEUE = "*";

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** The middle of `<purpose>.<middle>.<expires>.<sig>`, when a secret signed it and it has not expired. */
function verified(
  secrets: readonly string[],
  purpose: "link" | "session",
  token: string,
  nowSeconds: number,
): string | null {
  const cut = token.lastIndexOf(".");
  if (cut <= 0) return null;
  const payload = token.slice(0, cut);
  const signature = token.slice(cut + 1);
  if (!secrets.some((secret) => timingSafeEqualStrings(signature, sign(secret, payload)))) {
    return null;
  }
  const fields = payload.split(".");
  const expires = Number(fields.at(-1));
  if (fields[0] !== purpose || fields.length < 3) return null;
  if (!Number.isInteger(expires) || expires <= nowSeconds) return null;
  return fields.slice(1, -1).join(".");
}

function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    return safeDecode(part.slice(eq + 1).trim()) ?? undefined;
  }
  return undefined;
}

function bearer(req: Request): string | undefined {
  const header = req.header("authorization");
  return header?.toLowerCase().startsWith("bearer ") ? header.slice("bearer ".length) : undefined;
}

/** Queue name to its own expiry (seconds), read from a session cookie; expired queues are dropped. */
function sessionQueues(secrets: readonly string[], req: Request, now: number): Map<string, number> {
  const cookie = readCookie(req, SESSION_COOKIE);
  const entries = cookie ? verified(secrets, "session", cookie, now) : null;
  const scope = new Map<string, number>();
  for (const entry of entries ? entries.split(",") : []) {
    const cut = entry.lastIndexOf(":");
    const name = safeDecode(entry.slice(0, cut));
    const expires = Number(entry.slice(cut + 1));
    if (name !== null && Number.isInteger(expires) && expires > now) scope.set(name, expires);
  }
  return scope;
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** bull-board routes that read across queues, or Redis itself, with no visibility check of their own. */
function crossQueueRead(req: Request, scope: ReadonlyMap<string, number>): boolean {
  if (req.path.startsWith("/api/redis")) return true;
  if (!req.path.startsWith("/api/metrics")) return false;
  const queue = typeof req.query.queue === "string" ? req.query.queue : undefined;
  return req.method !== "GET" || queue === undefined || !scope.has(queue);
}

/** A signed link adds its queue, with its own hour, to a signed session; bull-board shows only those. */
function requireSignedLink(
  secrets: readonly string[],
  basePath: string,
  queueNames: ReadonlyMap<string, string>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    delete req.headers[SCOPE_HEADER];
    const proxied = bearer(req);
    if (proxied && secrets.some((secret) => timingSafeEqualStrings(proxied, secret))) {
      req.headers[SCOPE_HEADER] = EVERY_QUEUE;
      next();
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    const scope = sessionQueues(secrets, req, now);
    const link = typeof req.query[LINK_PARAM] === "string" ? req.query[LINK_PARAM] : undefined;
    const linked = link ? verified(secrets, "link", link, now) : null;
    const name = linked === null ? undefined : queueNames.get(linked);
    if (name !== undefined) {
      scope.set(name, now + SESSION_TTL_SECONDS);
      const latest = Math.max(...scope.values());
      const entries = [...scope].map(
        ([queue, expires]) => `${encodeURIComponent(queue)}:${expires}`,
      );
      const payload = `session.${entries.join(",")}.${latest}`;
      res.cookie(SESSION_COOKIE, `${payload}.${sign(secrets[0] ?? "", payload)}`, {
        httpOnly: true,
        sameSite: "lax",
        secure: req.secure,
        path: basePath,
        maxAge: (latest - now) * 1000,
      });
    }
    if (scope.size === 0) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (crossQueueRead(req, scope)) {
      res.status(404).json({ error: "not found" });
      return;
    }
    req.headers[SCOPE_HEADER] = [...scope.keys()].map(encodeURIComponent).join(",");
    next();
  };
}

function visibleIn(name: string) {
  return (req: { headers: Record<string, unknown> }): boolean => {
    const scope = req.headers[SCOPE_HEADER];
    if (scope === EVERY_QUEUE) return true;
    return typeof scope === "string" && scope.split(",").map(safeDecode).includes(name);
  };
}

/** Start a bull-board Express server on its own port. */
export function startBoardServer(opts: StartBoardServerOptions): Server {
  if ("token" in (opts.auth ?? {})) {
    throw new Error(
      "startBoardServer: `auth.token` is now `auth.secret`, and the board no longer accepts " +
        "`?token=` links. Set `boardSecret` on each queue() to the same value; its page signs a " +
        "link that expires in a minute.",
    );
  }
  const secret = opts.auth?.secret;
  const secrets = (typeof secret === "string" ? [secret] : [...(secret ?? [])]).filter(Boolean);
  if (secrets.length === 0) {
    throw new Error(
      "startBoardServer: `auth.secret` is required — bull-board has no auth of its own and " +
        "exposes destructive job controls (retry / remove / drain). Pass a long, random secret " +
        "via `auth: { secret }` and set the same value as `boardSecret` on each queue().",
    );
  }

  const app = express();
  app.set("trust proxy", opts.trustedProxies ?? 0);
  const basePath = opts.basePath ?? "/";
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(basePath);

  const queueNames = new Map<string, string>();
  const adapters = Object.entries(opts.queues).map(([key, queue]) => {
    queueNames.set(key, queue.name);
    queueNames.set(queue.name, queue.name);
    const adapter = new BullBoardMQAdapter(queue);
    adapter.setVisibilityGuard(visibleIn(queue.name));
    return adapter;
  });
  createBullBoard({ queues: adapters, serverAdapter });

  app.use(basePath, requireSignedLink(secrets, basePath, queueNames), serverAdapter.getRouter());

  const port = opts.port ?? 3001;
  const bindHost = opts.bindHost ?? "127.0.0.1";
  return app.listen(port, bindHost);
}

import type { AdminConfig, RateLimiter, RequestContext, Scope, Session } from "@flowpanel/core";
import { checkRequireRole, createRateLimiter, FlowpanelRateLimitError } from "@flowpanel/core";
import { actorIdFromSession } from "./action-helpers";

export interface BuildRequestCtxArgs {
  req: Request;
  config: AdminConfig;
  requestId?: string;
}

function requestIdFrom(req: Request): string {
  const supplied = req.headers.get("x-request-id");
  if (supplied && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied)) return supplied;
  return crypto.randomUUID();
}

const limiterCache = new WeakMap<object, RateLimiter | null>();
const requestContextCache = new WeakMap<Request, WeakMap<object, Promise<RequestContext>>>();

function getLimiter(config: AdminConfig): RateLimiter | null {
  const cached = limiterCache.get(config as unknown as object);
  if (cached !== undefined) return cached;
  const cfg = config.rateLimit;
  if (!cfg || cfg.enabled === false) {
    limiterCache.set(config as unknown as object, null);
    return null;
  }
  const limiter = createRateLimiter(cfg);
  limiterCache.set(config as unknown as object, limiter);
  return limiter;
}

function rateLimitKey(
  config: AdminConfig,
  reqCtx: { session: Session | null; ip: string | null },
): string {
  const per = config.rateLimit?.per ?? "user";
  if (per === "ip") return `ip:${reqCtx.ip ?? "unknown"}`;
  const uid = actorIdFromSession(reqCtx.session, config.auth.userId);
  if (uid !== null) return `user:${uid}`;
  return `ip:${reqCtx.ip ?? "unknown"}`;
}

async function resolveRequestContext({
  req,
  config,
  requestId,
}: BuildRequestCtxArgs): Promise<RequestContext> {
  const session: Session | null = await config.auth.session(req);
  const role = config.auth.role(session);
  checkRequireRole(config.auth.requireRole, role, session);

  let scope: Scope = null;
  if (config.scope) {
    const out = await config.scope({ req, session });
    scope = out ?? null;
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  const limiter = getLimiter(config);
  if (limiter) {
    const key = rateLimitKey(config, { session, ip });
    const allowed = await limiter.check(key);
    if (!allowed) throw new FlowpanelRateLimitError();
  }

  return { requestId: requestId ?? requestIdFrom(req), req, session, role, scope, ip, userAgent };
}

/**
 * Resolve identity, rate limiting and tenant scope exactly once for one
 * incoming Request/admin pair. All generated and headless surfaces share this
 * binding, so a page with several reads cannot accidentally authenticate or
 * consume the request limit several times.
 */
export function buildRequestContext(args: BuildRequestCtxArgs): Promise<RequestContext> {
  let byAdmin = requestContextCache.get(args.req);
  if (!byAdmin) {
    byAdmin = new WeakMap<object, Promise<RequestContext>>();
    requestContextCache.set(args.req, byAdmin);
  }

  const adminKey = args.config as unknown as object;
  const existing = byAdmin.get(adminKey);
  if (existing) return existing;

  const pending = resolveRequestContext(args);
  byAdmin.set(adminKey, pending);
  // A transient auth/provider failure must not poison a Request forever. This
  // mainly helps test harnesses and error boundaries that retry the same input.
  void pending.catch(() => byAdmin?.delete(adminKey));
  return pending;
}

/** @internal Seed the binding for a synthetic request created by a controller. */
export function bindRequestContext(
  req: Request,
  config: AdminConfig,
  context: RequestContext,
): void {
  let byAdmin = requestContextCache.get(req);
  if (!byAdmin) {
    byAdmin = new WeakMap<object, Promise<RequestContext>>();
    requestContextCache.set(req, byAdmin);
  }
  byAdmin.set(config as unknown as object, Promise.resolve(context));
}

export { requestIdFrom };

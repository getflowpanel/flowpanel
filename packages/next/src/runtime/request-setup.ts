import type { AdminDefinition, RateLimiter, RequestContext, Scope, Session } from "@flowpanel/core";
import { createRateLimiter, FlowpanelRateLimitError } from "@flowpanel/core";
import { clientIpFrom } from "@flowpanel/core/internal";
import { actorIdFromSession } from "./action-helpers";
import { requireAccessIfSet } from "./require-access";

export interface BuildRequestCtxArgs {
  req: Request;
  config: AdminDefinition;
  requestId?: string;
  /** `false` resolves the caller without counting a hit, for a wall drawn after the limit refused this request. */
  rateLimit?: boolean;
}

function requestIdFrom(req: Request): string {
  const supplied = req.headers.get("x-request-id");
  if (supplied && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied)) return supplied;
  return crypto.randomUUID();
}

const limiterCache = new WeakMap<object, RateLimiter | null>();
const requestContextCache = new WeakMap<Request, WeakMap<object, Promise<RequestContext>>>();

function getLimiter(config: AdminDefinition): RateLimiter | null {
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

/** `null` when the caller has neither an IP nor a user id: one shared bucket would let anyone lock everyone out. */
function rateLimitKey(
  config: AdminDefinition,
  reqCtx: { session: Session | null; ip: string | null },
): string | null {
  if (config.rateLimit?.per === "ip" && reqCtx.ip) return `ip:${reqCtx.ip}`;
  const uid = actorIdFromSession(reqCtx.session, config.auth.userId);
  if (uid !== null) return `user:${uid}`;
  return reqCtx.ip ? `ip:${reqCtx.ip}` : null;
}

async function resolveRequestContext({
  req,
  config,
  requestId,
  rateLimit = true,
}: BuildRequestCtxArgs): Promise<RequestContext> {
  const session: Session | null = await config.auth.session(req);
  const role = await config.auth.role(session);
  await requireAccessIfSet(config.auth.access, { session, role, scope: null });

  let scope: Scope = null;
  if (config.scope) {
    const out = await config.scope({ req, session });
    scope = out ?? null;
  }

  const ip = clientIpFrom(req.headers, config.security?.trustedProxies ?? 0);
  const userAgent = req.headers.get("user-agent") ?? null;

  const limiter = rateLimit ? getLimiter(config) : null;
  if (limiter) {
    const key = rateLimitKey(config, { session, ip });
    if (key !== null && !(await limiter.check(key))) throw new FlowpanelRateLimitError();
  }

  return { requestId: requestId ?? requestIdFrom(req), req, session, role, scope, ip, userAgent };
}

/**
 * Resolves identity, rate limiting and tenant scope exactly once for one incoming Request/admin pair.
 * All generated and headless surfaces share this binding, so several reads never re-authenticate.
 */
export function buildRequestContext(args: BuildRequestCtxArgs): Promise<RequestContext> {
  if (args.rateLimit === false) return resolveRequestContext(args);
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
  // A transient auth/provider failure must not poison a Request forever.
  void pending.catch(() => byAdmin?.delete(adminKey));
  return pending;
}

/** @internal Seed the binding for a synthetic request created by a controller. */
export function bindRequestContext(
  req: Request,
  config: AdminDefinition,
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

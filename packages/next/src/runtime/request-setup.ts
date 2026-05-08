import type { AdminConfig, RateLimiter, RequestContext, Scope, Session } from "@flowpanel/core";
import { checkRequireRole, createRateLimiter, FlowpanelRateLimitError } from "@flowpanel/core";

export interface BuildRequestCtxArgs {
  req: Request;
  config: AdminConfig;
}

const limiterCache = new WeakMap<object, RateLimiter | null>();

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
  const s = reqCtx.session as { user?: { id?: unknown } } | null;
  const uid = s?.user?.id;
  if (uid !== undefined && uid !== null && uid !== "") return `user:${String(uid)}`;
  return `ip:${reqCtx.ip ?? "unknown"}`;
}

export async function buildRequestContext({
  req,
  config,
}: BuildRequestCtxArgs): Promise<RequestContext> {
  const session: Session | null = await config.auth.session();
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

  return { req, session, role, scope, ip, userAgent };
}

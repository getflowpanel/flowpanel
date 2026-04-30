import type { AdminConfig, RequestContext, Scope, Session } from "@flowpanel/core";
import { checkRequireRole } from "@flowpanel/core";

export interface BuildRequestCtxArgs {
  req: Request;
  config: AdminConfig;
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
  return { req, session, role, scope, ip, userAgent };
}

import type { AuthConfig } from "../types/config";
import type { Session } from "../types/session";

/** The part of a better-auth instance FlowPanel calls. */
export interface BetterAuthLike {
  api: { getSession(args: { headers: Headers }): Promise<unknown> };
}

export interface BetterAuthOptions {
  /** Your better-auth instance — whatever `betterAuth({ … })` returned. */
  auth: BetterAuthLike;
  /** Roles allowed into the admin. */
  requireRole?: string | string[] | ((s: Session | null) => boolean);
  signInUrl?: string;
  forbiddenUrl?: string;
  /**
   * Extract the role from the better-auth session. May return a promise, so a
   * role held in your own table can be looked up per request.
   */
  role?: (s: Session | null) => string | Promise<string>;
  /** Extract the actor id for the audit trail / per-user rate limiting. */
  userId?: (s: Session | null) => string | null;
}

/** First-class better-auth integration. */
export function withBetterAuth(opts: BetterAuthOptions): AuthConfig {
  return {
    async session(req: Request): Promise<Session | null> {
      // A provider that cannot answer means "not signed in", never "signed in
      // as something unreadable": both are denied, and only one is honest.
      const s = await opts.auth.api.getSession({ headers: req.headers }).catch(() => null);
      if (s === null || typeof s !== "object") return null;
      const user = (s as { user?: unknown }).user;
      return user !== null && typeof user === "object" ? (s as Session) : null;
    },
    role:
      opts.role ??
      ((s: Session | null): string => {
        const user = (s as { user?: { role?: unknown } } | null)?.user;
        return typeof user?.role === "string" ? user.role : "guest";
      }),
    userId:
      opts.userId ??
      ((s: Session | null): string | null => {
        const id = (s as { user?: { id?: unknown } } | null)?.user?.id;
        return id === undefined || id === null ? null : String(id);
      }),
    ...(opts.requireRole !== undefined ? { requireRole: opts.requireRole } : {}),
    ...(opts.signInUrl ? { signInUrl: opts.signInUrl } : {}),
    ...(opts.forbiddenUrl ? { forbiddenUrl: opts.forbiddenUrl } : {}),
  };
}

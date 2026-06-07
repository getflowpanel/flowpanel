import type { AuthConfig } from "../types/config.js";
import type { Session } from "../types/session.js";

export interface NextAuthOptions {
  /** Your NextAuth (Auth.js) `auth()` function — typically from `@/auth`. */
  auth: () => Promise<unknown>;
  /** Roles allowed into the admin. */
  requireRole?: string | string[] | ((s: Session | null) => boolean);
  signInUrl?: string;
  forbiddenUrl?: string;
  /** Extract the role from the NextAuth session. */
  role?: (s: Session | null) => string;
  /** Extract the actor id for the audit trail / per-user rate limiting. */
  userId?: (s: Session | null) => string | null;
}

/** First-class NextAuth (Auth.js v5) integration. */
export function withNextAuth(opts: NextAuthOptions): AuthConfig {
  return {
    async session(): Promise<Session | null> {
      const s = await opts.auth();
      return (s ?? null) as Session | null;
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

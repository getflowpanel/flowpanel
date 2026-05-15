import type { AuthConfig } from "../types/config.js";
import type { Session } from "../types/session.js";

export interface NextAuthOptions {
  /**
   * Your NextAuth (Auth.js) `auth()` function — typically from `@/auth`.
   * NextAuth setups vary widely, so we accept the function directly
   * rather than hardcoding an import path.
   */
  auth: () => Promise<unknown>;
  /** Roles allowed into the admin. */
  requireRole?: string | string[] | ((s: Session | null) => boolean);
  signInUrl?: string;
  forbiddenUrl?: string;
  /**
   * Extract the role from the NextAuth session.
   * Defaults to `session.user.role || "guest"`.
   */
  role?: (s: Session | null) => string;
}

/**
 * First-class NextAuth (Auth.js v5) integration.
 *
 * @example
 * import { defineAdmin } from "flowpanel";
 * import { withNextAuth } from "flowpanel/auth";
 * import { auth } from "@/auth";   // your NextAuth() instance
 *
 * export default defineAdmin({
 *   auth: withNextAuth({ auth, requireRole: "admin" }),
 *   // ...
 * });
 *
 * Pass `auth` as a function reference; FlowPanel calls it inside RSC
 * pages and Server Actions. NextAuth's session shape is preserved.
 */
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
    ...(opts.requireRole !== undefined ? { requireRole: opts.requireRole } : {}),
    ...(opts.signInUrl ? { signInUrl: opts.signInUrl } : {}),
    ...(opts.forbiddenUrl ? { forbiddenUrl: opts.forbiddenUrl } : {}),
  };
}

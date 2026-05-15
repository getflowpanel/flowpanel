import type { AuthConfig } from "../types/config.js";
import type { Session } from "../types/session.js";

/**
 * Minimal duck-type for a Lucia v3+ instance. Avoids a hard dep on
 * `lucia` so users on different versions stay compatible.
 */
export interface LuciaLike {
  validateSession(sessionId: string): Promise<{
    user: Record<string, unknown> | null;
    session: Record<string, unknown> | null;
  }>;
  sessionCookieName: string;
}

export interface LuciaAuthOptions {
  /** Your Lucia instance. */
  lucia: LuciaLike;
  /** Roles allowed into the admin. */
  requireRole?: string | string[] | ((s: Session | null) => boolean);
  signInUrl?: string;
  forbiddenUrl?: string;
  /** Extract the role from the Lucia user. Defaults to `user.role || "guest"`. */
  role?: (s: Session | null) => string;
}

/**
 * First-class Lucia (v3+) integration.
 *
 * @example
 * import { defineAdmin } from "flowpanel";
 * import { withLucia } from "flowpanel/auth";
 * import { lucia } from "@/auth/lucia";
 *
 * export default defineAdmin({
 *   auth: withLucia({ lucia, requireRole: "admin" }),
 *   // ...
 * });
 *
 * Reads the session cookie from the incoming request via
 * `next/headers`. If the cookie is missing or invalid, `session()`
 * returns `null` and FlowPanel redirects to `signInUrl`.
 */
export function withLucia(opts: LuciaAuthOptions): AuthConfig {
  return {
    async session(): Promise<Session | null> {
      // Lazy specifier: TypeScript does not statically resolve the import.
      const specifier = "next/headers";
      const mod = (await import(specifier).catch(() => null)) as {
        cookies: () => Promise<{ get: (name: string) => { value: string } | undefined }>;
      } | null;
      if (!mod) {
        throw new Error(
          "withLucia: next/headers is unavailable. Lucia integration requires Next.js 15+.",
        );
      }
      const cookieStore = await mod.cookies();
      const sessionId = cookieStore.get(opts.lucia.sessionCookieName)?.value;
      if (!sessionId) return null;
      const { user } = await opts.lucia.validateSession(sessionId);
      return (user ?? null) as Session | null;
    },
    role:
      opts.role ??
      ((s: Session | null): string => {
        const r = (s as { role?: unknown } | null)?.role;
        return typeof r === "string" ? r : "guest";
      }),
    ...(opts.requireRole !== undefined ? { requireRole: opts.requireRole } : {}),
    ...(opts.signInUrl ? { signInUrl: opts.signInUrl } : {}),
    ...(opts.forbiddenUrl ? { forbiddenUrl: opts.forbiddenUrl } : {}),
  };
}

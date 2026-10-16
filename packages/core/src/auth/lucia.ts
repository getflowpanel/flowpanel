import type { AccessRule, AuthConfig, Session } from "@flowpanel/core";
import { fromProvider } from "../auth-provider";
import { assertNoAuthRequireRole } from "../compiler/validate/removed-keys";

/** Minimal duck-type for a Lucia v3+ instance. */
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
  /** Who may enter the admin: a role, a role list, or a predicate. */
  access?: AccessRule;
  signInUrl?: string;
  forbiddenUrl?: string;
  /** Extract the role from the Lucia user. Defaults to `user.role || "guest"`. */
  role?: (s: Session | null) => string;
  /** Extract the actor id for the audit trail / per-user rate limiting. */
  userId?: (s: Session | null) => string | null;
}

/** First-class Lucia (v3+) integration. */
export function withLucia(opts: LuciaAuthOptions): AuthConfig {
  assertNoAuthRequireRole("withLucia", opts);
  return fromProvider("Lucia", {
    async session(): Promise<Session | null> {
      const specifier = "next/headers";
      const mod = (await import(/* webpackIgnore: true */ specifier).catch(() => null)) as {
        cookies: () => Promise<{ get: (name: string) => { value: string } | undefined }>;
      } | null;
      if (!mod) {
        throw new Error(
          "withLucia: could not load next/headers to read the session cookie. withLucia works only in a Next.js app's server code.",
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
    userId:
      opts.userId ??
      ((s: Session | null): string | null => {
        const id = (s as { id?: unknown } | null)?.id;
        return id === undefined || id === null ? null : String(id);
      }),
    ...(opts.access !== undefined ? { access: opts.access } : {}),
    ...(opts.signInUrl ? { signInUrl: opts.signInUrl } : {}),
    ...(opts.forbiddenUrl ? { forbiddenUrl: opts.forbiddenUrl } : {}),
  });
}

import type { AuthConfig } from "../types/config";
import type { Session } from "../types/session";

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
  /** Roles allowed into the admin. */
  requireRole?: string | string[] | ((s: Session | null) => boolean);
  signInUrl?: string;
  forbiddenUrl?: string;
  /** Extract the role from the Lucia user. Defaults to `user.role || "guest"`. */
  role?: (s: Session | null) => string;
  /** Extract the actor id for the audit trail / per-user rate limiting. */
  userId?: (s: Session | null) => string | null;
}

/** First-class Lucia (v3+) integration. */
export function withLucia(opts: LuciaAuthOptions): AuthConfig {
  return {
    async session(): Promise<Session | null> {
      const specifier = "next/headers";
      const mod = (await import(/* webpackIgnore: true */ specifier).catch(() => null)) as {
        cookies: () => Promise<{ get: (name: string) => { value: string } | undefined }>;
      } | null;
      if (!mod) {
        throw new Error(
          "withLucia: next/headers is unavailable. Lucia integration requires Next.js 16.3+.",
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
    ...(opts.requireRole !== undefined ? { requireRole: opts.requireRole } : {}),
    ...(opts.signInUrl ? { signInUrl: opts.signInUrl } : {}),
    ...(opts.forbiddenUrl ? { forbiddenUrl: opts.forbiddenUrl } : {}),
  };
}

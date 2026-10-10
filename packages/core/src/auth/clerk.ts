import type { AccessRule, AuthConfig, Session } from "@flowpanel/core";
import { assertNoAuthRequireRole } from "../compiler/validate/removed-keys";

export interface ClerkAuthOptions {
  /** Who may enter the admin: a role, a role list, or a predicate. */
  access?: AccessRule;
  /** URL to redirect unauthenticated users to. */
  signInUrl?: string;
  /** URL to redirect users without the required role. */
  forbiddenUrl?: string;
  /** Extract the role from the Clerk session. */
  role?: (s: Session | null) => string;
  /** Extract the actor id for the audit trail / per-user rate limiting. */
  userId?: (s: Session | null) => string | null;
}

/** The Clerk user id always wins over a custom session claim named `id`. */
export function clerkSession(
  userId: string | null,
  sessionClaims: Record<string, unknown> | undefined,
): Session | null {
  if (!userId) return null;
  return { ...sessionClaims, id: userId } as Session;
}

/** First-class Clerk integration. */
export function withClerk(opts: ClerkAuthOptions = {}): AuthConfig {
  assertNoAuthRequireRole("withClerk", opts);
  return {
    async session(): Promise<Session | null> {
      const specifier = "@clerk/nextjs/server";
      const mod = (await import(/* webpackIgnore: true */ specifier).catch(() => null)) as {
        auth: () => Promise<{ userId: string | null; sessionClaims?: Record<string, unknown> }>;
      } | null;
      if (!mod) {
        throw new Error("withClerk: @clerk/nextjs is not installed. Run `pnpm add @clerk/nextjs`.");
      }
      const { userId, sessionClaims } = await mod.auth();
      return clerkSession(userId, sessionClaims);
    },
    role:
      opts.role ??
      ((s: Session | null): string => {
        const claims = (s?.publicMetadata ?? {}) as Record<string, unknown>;
        const r = claims.role;
        return typeof r === "string" ? r : "guest";
      }),
    userId:
      opts.userId ??
      ((s: Session | null): string | null => {
        const id = (s as { id?: unknown } | null)?.id;
        return typeof id === "string" ? id : null;
      }),
    ...(opts.access !== undefined ? { access: opts.access } : {}),
    ...(opts.signInUrl ? { signInUrl: opts.signInUrl } : {}),
    ...(opts.forbiddenUrl ? { forbiddenUrl: opts.forbiddenUrl } : {}),
  };
}

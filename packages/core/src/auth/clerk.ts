import type { AccessRule, AuthConfig, Session } from "@flowpanel/core";
import { assertNoAuthRequireRole } from "../validate-removed-keys";

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
      if (!userId) return null;
      return { id: userId, ...sessionClaims } as Session;
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

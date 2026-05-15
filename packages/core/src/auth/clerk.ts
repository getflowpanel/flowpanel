import type { AuthConfig } from "../types/config.js";
import type { Session } from "../types/session.js";

export interface ClerkAuthOptions {
  /** Roles allowed into the admin. Pass a single role, an array, or a custom predicate. */
  requireRole?: string | string[] | ((s: Session | null) => boolean);
  /** URL to redirect unauthenticated users to. */
  signInUrl?: string;
  /** URL to redirect users without the required role. */
  forbiddenUrl?: string;
  /**
   * Extract the role from the Clerk session. Defaults to
   * `sessionClaims.publicMetadata.role || "guest"`.
   */
  role?: (s: Session | null) => string;
}

/**
 * First-class Clerk integration.
 *
 * @example
 * import { defineAdmin } from "flowpanel";
 * import { withClerk } from "flowpanel/auth";
 *
 * export default defineAdmin({
 *   auth: withClerk({ requireRole: "admin" }),
 *   // ...
 * });
 *
 * Requires `@clerk/nextjs` as a peer dependency. The SDK loads lazily — if
 * `withClerk` is not used, no Clerk code is bundled.
 */
export function withClerk(opts: ClerkAuthOptions = {}): AuthConfig {
  return {
    async session(): Promise<Session | null> {
      // Lazy specifier: TypeScript does not statically resolve the import.
      const specifier = "@clerk/nextjs/server";
      const mod = (await import(specifier).catch(() => null)) as {
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
    ...(opts.requireRole !== undefined ? { requireRole: opts.requireRole } : {}),
    ...(opts.signInUrl ? { signInUrl: opts.signInUrl } : {}),
    ...(opts.forbiddenUrl ? { forbiddenUrl: opts.forbiddenUrl } : {}),
  };
}

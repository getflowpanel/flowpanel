import type { AuthConfig } from "../types/config.js";

/**
 * A fixed signed-in operator, for local development and examples: the session
 * is always `{ id: "dev" }` and `auth.role()` always returns `role`.
 *
 * It authenticates nobody — it sets no `requireRole`, so the admin still
 * answers anonymous requests and the "no access control" development warning
 * still fires. Swap it for a real provider before deploying.
 *
 * @param role Role every request is treated as having. Defaults to `"admin"`.
 */
export function devAuth(role = "admin"): AuthConfig {
  return {
    session: async () => ({ id: "dev" }),
    role: () => role,
  };
}

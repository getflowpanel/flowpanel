import type { AuthConfig } from "@flowpanel/core";

/**
 * A fixed signed-in operator for local development: the session is always `{ id: "dev" }`. It authenticates nobody — swap it for a real provider before deploying.
 * @param role Role every request is treated as having. Defaults to `"admin"`.
 */
export function devAuth(role = "admin"): AuthConfig {
  return {
    session: async () => ({ id: "dev" }),
    role: () => role,
  };
}

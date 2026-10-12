import type { AuthConfig } from "@flowpanel/core";
import { FlowpanelConfigError } from "../types/config-error";

const DEV_SESSION: unique symbol = Symbol.for("flowpanel.devAuth.session");

export function devAuthInProduction(): FlowpanelConfigError {
  return new FlowpanelConfigError(
    "auth",
    "devAuth() signs every request in as an admin, so it refuses to run in production. " +
      "Replace auth: devAuth() with your auth provider.",
  );
}

/**
 * A fixed signed-in operator for local development: the session is always `{ id: "dev" }`. It authenticates nobody, and it throws when `NODE_ENV` is `"production"`.
 * @param role Role every request is treated as having. Defaults to `"admin"`.
 */
export function devAuth(role = "admin"): AuthConfig {
  const session = async () => {
    if (process.env.NODE_ENV === "production") throw devAuthInProduction();
    return { id: "dev" };
  };
  return {
    session: Object.assign(session, { [DEV_SESSION]: true }),
    role: () => role,
  };
}

/** Whether `auth` is the `devAuth()` preset. */
export function isDevAuth(auth: AuthConfig): boolean {
  return Reflect.get(auth.session, DEV_SESSION) === true;
}

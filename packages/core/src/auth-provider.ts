import type { AuthConfig } from "@flowpanel/core";

const PROVIDER = Symbol.for("flowpanel.auth.provider");

/** Marks a preset's `session` with the provider it reads, for the sign-in screen's development note. */
export function fromProvider(name: string, auth: AuthConfig): AuthConfig {
  Object.assign(auth.session, { [PROVIDER]: name });
  return auth;
}

/** The provider an auth preset reads sessions from, such as `"better-auth"`; `undefined` for your own `auth`. */
export function authProvider(auth: Pick<AuthConfig, "session">): string | undefined {
  const name: unknown = Reflect.get(auth.session, PROVIDER);
  return typeof name === "string" ? name : undefined;
}

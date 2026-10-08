import { accessAdmitsSignedOut } from "./auth-probe";
import type { AdminDefinition } from "./types/config";
import type { ResourceConfig } from "./types/resource";

const MESSAGE =
  "[flowpanel] This admin has no access control: auth.access is unset, no " +
  "resource sets access, and there is no global scope. FlowPanel never requires " +
  "a session on its own, so every route — list, detail, create, update, delete, " +
  "row/bulk/dashboard actions, import, drawer and the SSE stream — answers anonymous " +
  "requests. Gate it with auth: { access: ({ session }) => session !== null } (or a role name). " +
  "If this deployment is meant to be open — behind a VPN or an authenticating proxy — " +
  "declare it with auth: { allowUnauthenticated: true } to silence this warning. " +
  "Development only; it never prints in production.";

const SIGNED_OUT_MESSAGE =
  "[flowpanel] auth.access lets a signed-out visitor in: asked at startup with " +
  "{ session: null }, it allowed the request, so every route answers anonymous requests. " +
  "A rule function receives { session, role, scope }, not the session: write " +
  "auth: { access: ({ session }) => session !== null }. If this admin is meant to be open, " +
  "declare it with auth: { allowUnauthenticated: true }. Production refuses to start with it " +
  "unless the admin is also readOnly.";

/** Dev-only diagnostic: nothing anywhere in this config can reject a request. */
export function warnIfNoAccessControl(config: AdminDefinition, resources: ResourceConfig[]): void {
  if (process.env.NODE_ENV !== "development") return;
  if (config.auth.allowUnauthenticated === true) return;
  if (accessAdmitsSignedOut(config.auth)) {
    console.warn(SIGNED_OUT_MESSAGE);
    return;
  }
  if (config.auth.access !== undefined) return;
  if (config.scope !== undefined) return;
  for (const r of resources) {
    if (r.options.access !== undefined) return;
  }
  console.warn(MESSAGE);
}

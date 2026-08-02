import type { AdminConfig } from "./types/config.js";
import type { ResourceConfig } from "./types/resource.js";

const MESSAGE =
  "[flowpanel] This admin has no access control: auth.requireRole is unset, no " +
  "resource sets requireRole, and there is no global scope. FlowPanel never requires " +
  "a session on its own, so every route — list, detail, create, update, delete, " +
  "row/bulk/dashboard actions, import, drawer and the SSE stream — answers anonymous " +
  "requests. Gate it with auth: { requireRole: (s) => s !== null } (or a role name). " +
  "If this deployment is meant to be open — behind a VPN or an authenticating proxy — " +
  "declare it with auth: { allowUnauthenticated: true } to silence this warning. " +
  "Development only; it never prints in production.";

/** Dev-only diagnostic: nothing anywhere in this config can reject a request. */
export function warnIfNoAccessControl(config: AdminConfig, resources: ResourceConfig[]): void {
  if (process.env.NODE_ENV !== "development") return;
  if (config.auth.allowUnauthenticated === true) return;
  if (config.auth.requireRole !== undefined) return;
  if (config.scope !== undefined) return;
  for (const r of resources) {
    if (r.options.requireRole !== undefined) return;
  }
  console.warn(MESSAGE);
}

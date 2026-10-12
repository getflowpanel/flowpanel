import type { AuthConfig } from "../../types/config";

function isThenable(value: unknown): boolean {
  return typeof value === "object" && value !== null && "then" in value;
}

/** Whether `auth.access` admits `{ session: null }` at startup; an async rule or role counts as closed. */
export function accessAdmitsSignedOut(auth: AuthConfig): boolean {
  const rule = auth.access;
  if (rule === undefined || rule === false) return false;
  if (rule === true) return true;
  let role: unknown;
  try {
    role = auth.role(null);
  } catch {
    return false;
  }
  if (typeof role !== "string") return false;
  if (typeof rule !== "function") return (Array.isArray(rule) ? rule : [rule]).includes(role);
  try {
    const verdict: unknown = rule({ session: null, role, scope: null });
    return !isThenable(verdict) && Boolean(verdict);
  } catch {
    return false;
  }
}

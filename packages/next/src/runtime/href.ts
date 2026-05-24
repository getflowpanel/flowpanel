import type { ResolvedAdminConfig } from "@flowpanel/core";

/**
 * Build a URL under the admin's `basePath`. Every internal href in flowpanel
 * goes through this helper so a non-default `basePath` (e.g. `/internal/admin`)
 * works without per-call concatenation.
 *
 * Segments are joined with `/`; leading slashes on individual segments are
 * stripped so accidental `/${name}` callsites don't double up. Empty segments
 * are skipped. Pass primitive values directly — they're stringified.
 *
 * @example
 * ```ts
 * buildHref(config)                   // "/admin"
 * buildHref(config, "users")          // "/admin/users"
 * buildHref(config, "users", "u1")    // "/admin/users/u1"
 * buildHref(config, "/users")         // "/admin/users"  (leading slash stripped)
 * ```
 *
 * When `config.basePath === ""` (root-mounted admin), the result starts at
 * `/<first-segment>`.
 */
export function buildHref(
  config: ResolvedAdminConfig,
  ...segments: ReadonlyArray<string | number>
): string {
  const cleaned = segments
    .map((s) => String(s))
    .filter((s) => s !== "")
    .map((s) => (s.startsWith("/") ? s.slice(1) : s));

  if (cleaned.length === 0) return config.basePath || "/";
  return `${config.basePath}/${cleaned.join("/")}`;
}

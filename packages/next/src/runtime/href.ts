import type { ResolvedAdminConfig } from "@flowpanel/core";

/** Build a URL under the admin's `basePath`. */
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

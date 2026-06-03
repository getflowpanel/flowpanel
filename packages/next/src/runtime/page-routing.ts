import type { PageConfig, ResolvedAdminConfig } from "@flowpanel/core";

/**
 * Resolve a `PageConfig` for the given URL slug.
 *
 * Pages registered via `defineAdmin({ pages: [...] })` with a `component`
 * field are rendered in-shell at `<basePath>/<page.path>`. An empty slug
 * matches a page at `/`. Pages without a `component` (external `href`-only
 * entries) are not matched here — they appear in nav only.
 */
export function matchPage(slug: string[], config: ResolvedAdminConfig): PageConfig | null {
  const path = slug.length === 0 ? "/" : `/${slug.join("/")}`;
  const page = config.pagesByPath.get(path);
  if (!page) return null;
  if (!page.component) return null;
  return page;
}

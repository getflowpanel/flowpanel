import type { PageConfig, ResolvedAdminConfig } from "@flowpanel/core";

/** Resolve a `PageConfig` for the given URL slug. */
export function matchPage(slug: string[], config: ResolvedAdminConfig): PageConfig | null {
  const path = slug.length === 0 ? "/" : `/${slug.join("/")}`;
  const page = config.pagesByPath.get(path);
  if (!page) return null;
  if (!page.component) return null;
  return page;
}

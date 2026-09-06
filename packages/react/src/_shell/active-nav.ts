import type { NavGroup } from "./AdminNav";

/** Pick the most specific destination, matching complete URL segments only. */
export function activeNavHref(groups: NavGroup[], pathname: string): string | undefined {
  const path = pathname.replace(/\/$/, "") || "/";
  return groups
    .flatMap((g) => g.items)
    .map((item) => item.href)
    .filter((href) => {
      if (!href.startsWith("/") || href.startsWith("//") || /[?#]/.test(href))
        return href === pathname;
      const base = href.replace(/\/$/, "") || "/";
      return path === base || (base !== "/" && path.startsWith(`${base}/`));
    })
    .sort((a, b) => b.length - a.length)[0];
}

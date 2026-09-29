import type { NavGroup } from "./AdminNav";

const trimSlash = (href: string) => href.replace(/\/$/, "") || "/";
const isPath = (href: string) =>
  href.startsWith("/") && !href.startsWith("//") && !/[?#]/.test(href);
const under = (path: string, base: string) =>
  path === base || (base !== "/" && path.startsWith(`${base}/`));

/**
 * Pick the most specific destination, matching complete URL segments only. An entry that
 * every other entry sits under, the admin root, marks only its own page.
 */
export function activeNavHref(groups: NavGroup[], pathname: string): string | undefined {
  const path = trimSlash(pathname);
  const hrefs = groups.flatMap((g) => g.items).map((item) => item.href);
  const bases = hrefs.filter(isPath).map(trimSlash);
  return hrefs
    .filter((href) => {
      if (!isPath(href)) return href === pathname;
      const base = trimSlash(href);
      if (path === base) return true;
      const others = bases.filter((other) => other !== base);
      const root = others.length > 0 && others.every((other) => under(other, base));
      return !root && under(path, base);
    })
    .sort((a, b) => b.length - a.length)[0];
}

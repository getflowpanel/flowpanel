import type { NavGroup } from "./AdminNav";

const trimSlash = (href: string) => href.replace(/\/$/, "") || "/";
const isPath = (href: string) =>
  href.startsWith("/") && !href.startsWith("//") && !/[?#]/.test(href);
const under = (path: string, base: string) =>
  path === base || (base !== "/" && path.startsWith(`${base}/`));

/**
 * Pick the most specific destination, matching complete URL segments only. The admin root marks
 * only its own page: `rootHref` when given, else an entry every other entry sits under.
 */
export function activeNavHref(
  groups: NavGroup[],
  pathname: string,
  rootHref?: string,
): string | undefined {
  const path = trimSlash(pathname);
  const hrefs = groups.flatMap((g) => g.items).map((item) => item.href);
  const bases = hrefs.filter(isPath).map(trimSlash);
  const isRoot = (base: string): boolean => {
    if (rootHref !== undefined) return base === trimSlash(rootHref);
    const others = bases.filter((other) => other !== base);
    return others.length > 0 && others.every((other) => under(other, base));
  };
  return hrefs
    .filter((href) => {
      if (!isPath(href)) return href === pathname;
      const base = trimSlash(href);
      if (path === base) return true;
      return !isRoot(base) && under(path, base);
    })
    .sort((a, b) => b.length - a.length)[0];
}

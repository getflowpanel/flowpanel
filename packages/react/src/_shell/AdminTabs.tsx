"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { cn } from "../lib/cn.js";
import { AccountMenu, type AccountMenuUser } from "./AccountMenu.js";
import type { NavGroup } from "./AdminNav.js";
import { Brand, type ShellBrand } from "./Brand.js";

/** Horizontal tab strip variant of the admin nav. */
export function AdminTabs({
  groups,
  brand,
  user,
  currentPath,
}: {
  groups: NavGroup[];
  brand?: ShellBrand | undefined;
  user?: AccountMenuUser | undefined;
  currentPath: string;
}) {
  const hasBrand = Boolean(brand?.name ?? brand?.logo);
  const items = groups.flatMap((g) => g.items);
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: currentPath is the intentional trigger — the active tab is scrolled into view whenever the route changes.
  useEffect(() => {
    const el = activeRef.current;
    if (!el) return;
    el.scrollIntoView({ inline: "center", block: "nearest" });
  }, [currentPath]);

  return (
    <nav aria-label="Admin" className="border-b border-fp-border-1 bg-fp-bg-1">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6">
        {hasBrand ? <Brand brand={brand} className="flex-shrink-0 py-3" /> : null}
        <ul
          className={cn(
            "fp-scrollbar-hide flex flex-1 items-center gap-1 overflow-x-auto",
            !hasBrand && "-ml-3",
          )}
        >
          {items.map((it) => {
            const active = currentPath === it.href;
            return (
              <li key={it.href} className="flex-shrink-0">
                <Link
                  href={it.href}
                  ref={active ? activeRef : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative inline-flex h-11 items-center px-3 text-sm whitespace-nowrap transition-colors",
                    active ? "font-medium text-fp-text-1" : "text-fp-text-2 hover:text-fp-text-1",
                  )}
                >
                  {it.label}
                  {active ? (
                    <span aria-hidden className="absolute inset-x-3 bottom-0 h-0.5 bg-fp-accent" />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
        {user ? (
          <div className="flex-shrink-0 py-1.5">
            <AccountMenu user={user} align="end" className="w-auto" />
          </div>
        ) : null}
      </div>
    </nav>
  );
}

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
  const stripRef = useRef<HTMLUListElement | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: currentPath is the intentional trigger — the active tab is scrolled into view whenever the route changes.
  useEffect(() => {
    const el = activeRef.current;
    if (!el) return;
    el.scrollIntoView({ inline: "center", block: "nearest" });
  }, [currentPath]);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const sync = () => {
      const start = el.scrollLeft > 1;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      el.dataset.overflow = start && end ? "both" : start ? "start" : end ? "end" : "none";
    };
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, []);

  return (
    <nav
      aria-label="Admin"
      className="sticky top-0 z-40 border-b border-fp-border-1 bg-fp-bg-1/85 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 sm:gap-6 sm:px-6">
        {hasBrand ? <Brand brand={brand} className="hidden flex-shrink-0 py-3 sm:flex" /> : null}
        <ul
          ref={stripRef}
          className={cn(
            "fp-scroll-fade-x fp-scrollbar-hide flex flex-1 items-center gap-1 overflow-x-auto",
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
                    <span
                      aria-hidden
                      className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-fp-accent"
                    />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
        {user ? (
          <div className="flex-shrink-0 py-1.5">
            <AccountMenu user={user} align="end" className="w-auto" compact />
          </div>
        ) : null}
      </div>
    </nav>
  );
}

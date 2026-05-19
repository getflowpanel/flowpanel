"use client";
import { useEffect, useRef } from "react";
import { cn } from "../lib/cn.js";
import type { NavGroup } from "./AdminNav.js";

/**
 * Horizontal tab strip variant of the admin nav. Used for embedded admins
 * where the host app already owns the top-level chrome (header, brand,
 * user menu) and FlowPanel only needs an in-content tab switcher between
 * resources and dashboards.
 *
 * Groups are flattened — the visual hierarchy of "Dashboards" / "Resources"
 * collapses into a single row of tabs. Group labels are dropped: in tabs
 * mode the user-visible affordance is the tab itself, not its category.
 *
 * On narrow viewports the strip overflows horizontally rather than truncating;
 * the active tab is scrolled into view on route change so it never gets
 * clipped at the edge.
 */
export function AdminTabs({
  groups,
  brandName,
  currentPath,
}: {
  groups: NavGroup[];
  brandName?: string;
  currentPath: string;
}) {
  const items = groups.flatMap((g) => g.items);
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const el = activeRef.current;
    if (!el) return;
    // Avoid scroll-into-view causing the whole page to jump vertically: only
    // adjust the inline (horizontal) axis. `nearest` for block keeps vertical
    // position untouched.
    el.scrollIntoView({ inline: "center", block: "nearest" });
  }, [currentPath]);

  return (
    <div role="navigation" aria-label="Admin" className="border-b border-fp-border-1 bg-fp-bg-1">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6">
        {brandName ? (
          <div className="flex-shrink-0 py-3 text-sm font-semibold text-fp-text-1">{brandName}</div>
        ) : null}
        <ul className="fp-scrollbar-hide flex flex-1 items-center gap-1 overflow-x-auto">
          {items.map((it) => {
            const active = currentPath === it.href;
            return (
              <li key={it.href} className="flex-shrink-0">
                <a
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
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

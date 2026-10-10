"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { FlowpanelIcon } from "../_atoms/FlowpanelIcon";
import { useLabels } from "../_provider/LabelsContext";
import { cn } from "../lib/cn";
import { AccountMenu, type AccountMenuUser } from "./AccountMenu";
import type { NavGroup } from "./AdminNav";
import { activeNavHref } from "./active-nav";
import { Brand, type ShellBrand } from "./Brand";

/** Horizontal tab strip variant of the admin nav. */
export function AdminTabs({
  groups,
  brand,
  user,
  currentPath,
  rootHref,
}: {
  groups: NavGroup[];
  brand?: ShellBrand | undefined;
  user?: AccountMenuUser | undefined;
  currentPath: string;
  /** The admin's mount path; its entry is active only on that page. */
  rootHref?: string | undefined;
}) {
  const { navigation } = useLabels();
  const activeHref = activeNavHref(groups, currentPath, rootHref);
  const hasBrand = Boolean(brand?.name ?? brand?.logo);
  const items = groups.flatMap((g) => g.items);
  const activeRef = useRef<HTMLAnchorElement | null>(null);
  const stripRef = useRef<HTMLUListElement | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: currentPath is the intentional trigger — the active tab is scrolled into view whenever the route changes.
  useEffect(() => {
    const el = activeRef.current;
    const strip = stripRef.current;
    if (!el || !strip) return;
    const tabRect = el.getBoundingClientRect();
    const stripRect = strip.getBoundingClientRect();
    const centeredLeft =
      strip.scrollLeft + tabRect.left - stripRect.left - (strip.clientWidth - tabRect.width) / 2;
    strip.scrollLeft = Math.max(0, centeredLeft);
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
      aria-label={navigation.admin}
      data-flowpanel-nav=""
      className="fp-sticky fp-top-0 fp-z-40 fp-border-b fp-border-line fp-bg-surface/85 fp-backdrop-blur-md"
    >
      <p id="admin-tabs-scroll-hint" className="fp-sr-only">
        {navigation.scrollHint}
      </p>
      <div className="fp-mx-auto fp-flex fp-max-w-7xl fp-items-center fp-gap-2 fp-px-4 sm:fp-gap-6 sm:fp-px-6">
        {hasBrand ? (
          <Brand brand={brand} className="fp-hidden fp-flex-shrink-0 fp-py-3 sm:fp-flex" />
        ) : null}
        <ul
          ref={stripRef}
          aria-describedby="admin-tabs-scroll-hint"
          className={cn(
            "fp-scroll-fade-x fp-scrollbar-hide fp-flex fp-flex-1 fp-items-center fp-gap-1 fp-overflow-x-auto",
            !hasBrand && "-fp-ml-3",
          )}
        >
          {items.map((it) => {
            const active = activeHref === it.href;
            return (
              <li key={it.href} className="fp-flex-shrink-0">
                <Link
                  href={it.href}
                  ref={active ? activeRef : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "fp-relative fp-inline-flex fp-h-11 fp-items-center fp-px-3 fp-text-sm fp-whitespace-nowrap fp-transition-colors",
                    active ? "fp-font-medium fp-text-ink" : "fp-text-soft hover:fp-text-ink",
                  )}
                >
                  {it.icon ? (
                    <FlowpanelIcon name={it.icon} className="fp-mr-2 fp-h-4 fp-w-4 fp-shrink-0" />
                  ) : null}
                  {it.label}
                  {active ? (
                    <span
                      aria-hidden
                      className="fp-absolute fp-inset-x-3 fp-bottom-0 fp-h-[2px] fp-rounded-full fp-bg-ink"
                    />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
        {user ? (
          <div className="fp-flex-shrink-0 fp-py-1.5">
            <AccountMenu user={user} align="end" className="fp-w-auto" compact />
          </div>
        ) : null}
      </div>
    </nav>
  );
}

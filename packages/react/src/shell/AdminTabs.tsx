"use client";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FlowpanelIcon } from "../atoms/FlowpanelIcon";
import { cn } from "../lib/cn";
import { useLabels } from "../provider/LabelsContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { AccountMenu, type AccountMenuUser } from "./AccountMenu";
import type { NavGroup } from "./AdminNav";
import { activeNavHref } from "./active-nav";
import { Brand, type ShellBrand } from "./Brand";
import { NavLinkPending } from "./NavLinkPending";

/** How far into the strip's faded edge a tab may reach: its own padding, so its label stays clear of the fade. */
const FADE_INSET_PX = 12;

type Edges = { left: number; right: number };

/** The tabs the strip does not show whole, counting a faded edge as not shown. */
export function tabsCutOff(
  strip: Edges,
  tabs: ReadonlyArray<{ href: string; box: Edges }>,
  faded: { start: boolean; end: boolean },
): string[] {
  const left = strip.left + (faded.start ? FADE_INSET_PX : 0) - 1;
  const right = strip.right - (faded.end ? FADE_INSET_PX : 0) + 1;
  return tabs.filter(({ box }) => box.left < left || box.right > right).map(({ href }) => href);
}

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

  const [hidden, setHidden] = useState<string[]>([]);
  const hasMore = hidden.length > 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new route, or the More button taking room, brings the active tab back into view.
  useEffect(() => {
    const el = activeRef.current;
    const strip = stripRef.current;
    if (!el || !strip) return;
    // Scroll only as far as the active tab needs, so the strip starts on a whole tab.
    const tabRect = el.getBoundingClientRect();
    const stripRect = strip.getBoundingClientRect();
    const right = stripRect.right - FADE_INSET_PX;
    const left = stripRect.left + FADE_INSET_PX;
    if (tabRect.right > right) strip.scrollLeft += tabRect.right - right;
    else if (tabRect.left < left) strip.scrollLeft -= left - tabRect.left;
  }, [currentPath, hasMore]);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const sync = () => {
      const start = el.scrollLeft > 1;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      el.dataset.overflow = start && end ? "both" : start ? "start" : end ? "end" : "none";
      const cut = tabsCutOff(
        el.getBoundingClientRect(),
        Array.from(el.querySelectorAll<HTMLAnchorElement>("a[data-tab-href]")).map((tab) => ({
          href: tab.dataset.tabHref ?? "",
          box: tab.getBoundingClientRect(),
        })),
        { start, end },
      );
      setHidden((current) => (current.join("\n") === cut.join("\n") ? current : cut));
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
          <Brand
            brand={brand}
            fallback={navigation.admin}
            className="fp-hidden fp-flex-shrink-0 fp-py-3 sm:fp-flex"
          />
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
                  prefetch={false}
                  data-tab-href={it.href}
                  ref={active ? activeRef : undefined}
                  aria-current={active ? "page" : undefined}
                  // A tab the strip cuts off lives in the More menu, not half drawn beside it.
                  {...(hidden.includes(it.href) && !active
                    ? { "aria-hidden": true, tabIndex: -1 }
                    : {})}
                  className={cn(
                    "fp-relative fp-inline-flex fp-h-11 fp-items-center fp-px-3 fp-text-sm fp-whitespace-nowrap fp-transition-colors",
                    active ? "fp-font-medium fp-text-ink" : "fp-text-soft hover:fp-text-ink",
                    hidden.includes(it.href) && !active && "fp-invisible",
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
                  ) : (
                    <NavLinkPending className="fp-inset-x-3 fp-bottom-0 fp-h-[2px]" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        {hidden.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="fp-inline-flex fp-h-11 fp-flex-shrink-0 fp-items-center fp-gap-1 fp-rounded-sm fp-px-2 fp-text-sm fp-text-soft hover:fp-text-ink focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60"
              >
                {navigation.more}
                <ChevronDown aria-hidden className="fp-h-4 fp-w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="fp-min-w-48">
              {items
                .filter((it) => hidden.includes(it.href))
                .map((it) => (
                  <DropdownMenuItem key={it.href} asChild>
                    <Link
                      href={it.href}
                      prefetch={false}
                      aria-current={activeHref === it.href ? "page" : undefined}
                      className="fp-flex fp-min-h-11 fp-items-center fp-gap-2 sm:fp-min-h-0"
                    >
                      {it.icon ? (
                        <FlowpanelIcon name={it.icon} className="fp-h-4 fp-w-4 fp-shrink-0" />
                      ) : null}
                      {it.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {user ? (
          <div className="fp-flex-shrink-0 fp-py-1.5">
            <AccountMenu user={user} align="end" className="fp-w-auto" compact />
          </div>
        ) : null}
      </div>
    </nav>
  );
}

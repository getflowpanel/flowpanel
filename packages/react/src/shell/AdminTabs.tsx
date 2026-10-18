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

const GAP_PX = 4;

/** The tabs that move into More: every tab after the first ones that fit, the active tab always kept. */
export function tabsFolded(widths: ReadonlyArray<number>, active: number, room: number): number[] {
  const total = widths.reduce((sum, width) => sum + width, 0) + GAP_PX * (widths.length - 1);
  if (total <= room) return [];
  let used = widths[active] ?? -GAP_PX;
  let full = false;
  const folded: number[] = [];
  widths.forEach((width, index) => {
    if (index === active) return;
    if (!full && used + GAP_PX + width <= room) used += GAP_PX + width;
    else {
      full = true;
      folded.push(index);
    }
  });
  return folded;
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
  const stripRef = useRef<HTMLUListElement | null>(null);

  const [hidden, setHidden] = useState<string[]>([]);
  const hasMore = hidden.length > 0;
  const widths = useRef(new Map<string, number>());
  const activeIndex = items.findIndex((it) => it.href === activeHref);
  const itemKey = items.map((it) => it.href).join("\n");

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const hrefs = itemKey.split("\n");
    const sync = () => {
      for (const tab of el.querySelectorAll<HTMLElement>("li[data-tab-href]")) {
        if (tab.offsetWidth > 0) widths.current.set(tab.dataset.tabHref ?? "", tab.offsetWidth);
      }
      const folded = tabsFolded(
        hrefs.map((href) => widths.current.get(href) ?? 0),
        activeIndex,
        el.clientWidth - 1,
      ).flatMap((index) => hrefs[index] ?? []);
      setHidden((current) => (current.join("\n") === folded.join("\n") ? current : folded));
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [itemKey, activeIndex]);

  return (
    <nav
      aria-label={navigation.admin}
      data-flowpanel-nav=""
      className="fp-sticky fp-top-0 fp-z-40 fp-border-b fp-border-line fp-bg-surface/85 fp-backdrop-blur-md"
    >
      <div className="fp-mx-auto fp-flex fp-max-w-[103rem] fp-items-center fp-gap-2 fp-px-4 sm:fp-gap-6 sm:fp-px-6">
        {hasBrand ? (
          <Brand
            brand={brand}
            fallback={navigation.admin}
            className="fp-hidden fp-flex-shrink-0 fp-py-3 sm:fp-flex"
          />
        ) : null}
        {/* Tabs that do not fit wrap onto hidden lines until the strip knows which fold into More. */}
        <ul
          ref={stripRef}
          className={cn(
            "fp-flex fp-h-11 fp-flex-1 fp-flex-wrap fp-items-center fp-gap-1 fp-overflow-hidden",
            !hasBrand && "-fp-ml-3",
          )}
        >
          {items.map((it) => {
            const active = activeHref === it.href;
            return (
              <li
                key={it.href}
                data-tab-href={it.href}
                className={cn("fp-flex-shrink-0", hidden.includes(it.href) && "fp-hidden")}
              >
                <Link
                  href={it.href}
                  prefetch={false}
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
                  ) : (
                    <NavLinkPending className="fp-inset-x-3 fp-bottom-0 fp-h-[2px]" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        {items.length > 1 ? (
          // Held in place on a phone before it knows what is cut, so the strip does not jump when it does.
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                {...(hasMore ? {} : { "aria-hidden": true, tabIndex: -1 })}
                className={cn(
                  !hasMore && "fp-invisible sm:fp-hidden",
                  "fp-inline-flex fp-h-11 fp-flex-shrink-0 fp-items-center fp-gap-1 fp-rounded-sm fp-px-2 fp-text-sm fp-text-soft hover:fp-text-ink focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60",
                )}
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

"use client";
import type { IconName } from "@flowpanel/core";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { FlowpanelIcon } from "../atoms/FlowpanelIcon";
import { cn } from "../lib/cn";
import { LABEL_TEXT } from "../lib/label-text";
import { useLabels } from "../provider/LabelsContext";
import { AccountMenu, type AccountMenuUser } from "./AccountMenu";
import { activeNavHref } from "./active-nav";
import { Brand, type ShellBrand } from "./Brand";
import { NavLinkPending } from "./NavLinkPending";

export interface NavEntry {
  label: string;
  href: string;
  icon?: IconName;
}

export interface NavGroup {
  label?: string;
  items: NavEntry[];
  /** Fold the group under its label until it holds the current page. */
  collapsible?: boolean;
}

const GROUP_LABEL = cn("fp-px-2", LABEL_TEXT);

function NavItems({ items, activeHref }: { items: NavEntry[]; activeHref: string | undefined }) {
  const iconColumn = items.some((item) => item.icon);
  return (
    <ul className="fp-mt-1 fp-space-y-0.5">
      {items.map((it) => {
        const active = activeHref === it.href;
        return (
          <li key={it.href}>
            <Link
              href={it.href}
              prefetch={false}
              className={cn(
                "fp-relative fp-flex fp-min-h-11 fp-items-center fp-gap-2 fp-rounded fp-px-2.5 fp-py-1.5 fp-text-sm fp-transition-colors sm:fp-min-h-9",
                active
                  ? "fp-bg-fill fp-font-medium fp-text-ink"
                  : "fp-text-soft hover:fp-bg-fill/60 hover:fp-text-ink",
              )}
              aria-current={active ? "page" : undefined}
            >
              {it.icon ? (
                <FlowpanelIcon name={it.icon} className="fp-h-4 fp-w-4 fp-shrink-0" />
              ) : iconColumn ? (
                <span aria-hidden className="fp-flex fp-w-4 fp-shrink-0 fp-justify-center">
                  <span className="fp-h-1 fp-w-1 fp-rounded-full fp-bg-current fp-opacity-60" />
                </span>
              ) : null}
              <span>{it.label}</span>
              <NavLinkPending className="fp-inset-x-2.5 fp-bottom-0.5 fp-h-[2px]" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminNav({
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
  return (
    <nav
      aria-label={navigation.admin}
      data-flowpanel-nav=""
      className="fp-flex fp-h-full fp-w-64 fp-flex-shrink-0 fp-flex-col fp-border-r fp-border-line fp-bg-surface"
    >
      <Brand brand={brand} fallback={navigation.admin} className="fp-px-4 fp-py-4" />
      <ul className="fp-flex-1 fp-overflow-y-auto fp-px-2 fp-pb-4">
        {groups.map((g, gi) => (
          <li key={g.label ?? `group-${gi}`} className="fp-mt-4 first:fp-mt-0">
            {g.collapsible && g.label ? (
              <details className="fp-group" open={g.items.some((it) => it.href === activeHref)}>
                <summary
                  className={cn(
                    GROUP_LABEL,
                    "fp-flex fp-min-h-11 fp-cursor-pointer fp-list-none fp-items-center fp-justify-between fp-rounded hover:fp-text-soft sm:fp-min-h-9 [&::-webkit-details-marker]:fp-hidden",
                  )}
                >
                  {g.label}
                  <ChevronRight
                    aria-hidden
                    className="fp-h-3.5 fp-w-3.5 fp-transition-transform group-open:fp-rotate-90"
                  />
                </summary>
                <NavItems items={g.items} activeHref={activeHref} />
              </details>
            ) : (
              <>
                {g.label ? <div className={GROUP_LABEL}>{g.label}</div> : null}
                <NavItems items={g.items} activeHref={activeHref} />
              </>
            )}
          </li>
        ))}
      </ul>
      {user ? (
        <div className="fp-sticky fp-bottom-0 fp-border-t fp-border-line fp-bg-surface fp-p-2">
          <AccountMenu user={user} />
        </div>
      ) : null}
    </nav>
  );
}

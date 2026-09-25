"use client";
import type { IconName } from "@flowpanel/core";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { FlowpanelIcon } from "../_atoms/FlowpanelIcon";
import { useLabels } from "../_provider/LabelsContext";
import { cn } from "../lib/cn";
import { AccountMenu, type AccountMenuUser } from "./AccountMenu";
import { activeNavHref } from "./active-nav";
import { Brand, type ShellBrand } from "./Brand";

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

const GROUP_LABEL = "px-2 text-xs uppercase tracking-wide text-fp-text-3";

function NavItems({ items, activeHref }: { items: NavEntry[]; activeHref: string | undefined }) {
  return (
    <ul className="mt-1 space-y-0.5">
      {items.map((it) => {
        const active = activeHref === it.href;
        return (
          <li key={it.href}>
            <Link
              href={it.href}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-fp px-2.5 py-1.5 text-sm transition-colors sm:min-h-9",
                active
                  ? "bg-fp-accent/10 font-medium text-fp-accent-badge-text"
                  : "text-fp-text-2 hover:bg-fp-bg-3/60 hover:text-fp-text-1",
              )}
              aria-current={active ? "page" : undefined}
            >
              {it.icon ? <FlowpanelIcon name={it.icon} className="h-4 w-4 shrink-0" /> : null}
              <span>{it.label}</span>
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
}: {
  groups: NavGroup[];
  brand?: ShellBrand | undefined;
  user?: AccountMenuUser | undefined;
  currentPath: string;
}) {
  const { navigation } = useLabels();
  const activeHref = activeNavHref(groups, currentPath);
  return (
    <nav
      aria-label={navigation.admin}
      data-flowpanel-nav=""
      className="flex h-full w-64 flex-shrink-0 flex-col border-r border-fp-border-1 bg-fp-bg-1"
    >
      <Brand brand={brand} className="px-4 py-4" />
      <ul className="flex-1 overflow-y-auto px-2 pb-4">
        {groups.map((g, gi) => (
          <li key={g.label ?? `group-${gi}`} className="mt-4 first:mt-0">
            {g.collapsible && g.label ? (
              <details className="group" open={g.items.some((it) => it.href === activeHref)}>
                <summary
                  className={cn(
                    GROUP_LABEL,
                    "flex min-h-9 cursor-pointer list-none items-center justify-between rounded-fp hover:text-fp-text-2 [&::-webkit-details-marker]:hidden",
                  )}
                >
                  {g.label}
                  <ChevronRight
                    aria-hidden
                    className="h-3.5 w-3.5 transition-transform group-open:rotate-90"
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
        <div className="border-t border-fp-border-1 p-2">
          <AccountMenu user={user} />
        </div>
      ) : null}
    </nav>
  );
}

"use client";
import type { IconName } from "@flowpanel/core";
import Link from "next/link";
import { FlowpanelIcon } from "../_atoms/FlowpanelIcon.js";
import { cn } from "../lib/cn.js";
import { AccountMenu, type AccountMenuUser } from "./AccountMenu.js";
import { Brand, type ShellBrand } from "./Brand.js";

export interface NavEntry {
  label: string;
  href: string;
  icon?: IconName;
}

export interface NavGroup {
  label?: string;
  items: NavEntry[];
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
  return (
    <nav
      aria-label="Admin"
      className="flex h-full w-64 flex-shrink-0 flex-col border-r border-fp-border-1 bg-fp-bg-1"
    >
      <Brand brand={brand} className="px-4 py-4" />
      <ul className="flex-1 overflow-y-auto px-2 pb-4">
        {groups.map((g, gi) => (
          <li key={g.label ?? `group-${gi}`} className="mt-4 first:mt-0">
            {g.label ? (
              <div className="px-2 text-xs uppercase tracking-wide text-fp-text-3">{g.label}</div>
            ) : null}
            <ul className="mt-1 space-y-0.5">
              {g.items.map((it) => {
                const active = currentPath === it.href;
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
                      {it.icon ? (
                        <FlowpanelIcon name={it.icon} className="h-4 w-4 shrink-0" />
                      ) : null}
                      <span>{it.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
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

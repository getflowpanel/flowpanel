"use client";
import Link from "next/link";
import { cn } from "../lib/cn.js";
import { AccountMenu, type AccountMenuUser } from "./AccountMenu.js";
import { Brand, type ShellBrand } from "./Brand.js";

export interface NavEntry {
  label: string;
  href: string;
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
                        "block rounded-fp-sm px-2 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-fp-bg-2 text-fp-text-1 font-medium"
                          : "text-fp-text-2 hover:bg-fp-bg-2",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      {it.label}
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

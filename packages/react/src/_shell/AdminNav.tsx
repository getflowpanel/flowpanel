"use client";
import { cn } from "../lib/cn.js";

export interface NavEntry {
  label: string;
  href: string;
  icon?: string;
}

export interface NavGroup {
  label?: string;
  items: NavEntry[];
}

export function AdminNav({
  groups,
  brandName = "Admin",
  currentPath,
}: {
  groups: NavGroup[];
  brandName?: string;
  currentPath: string;
}) {
  return (
    <nav
      aria-label="Admin"
      className="h-full w-64 flex-shrink-0 border-r border-fp-border-1 bg-fp-bg-1"
    >
      <div className="px-4 py-4 text-sm font-semibold text-fp-text-1">{brandName}</div>
      <ul className="px-2 pb-4">
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
                    <a
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
                    </a>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}

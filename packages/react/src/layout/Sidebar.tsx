"use client";

import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Menu, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "../utils/cn";

export interface SidebarNavItem {
  id: string;
  label: string;
  /** Lucide icon or SVG string/URL */
  icon?: LucideIcon;
  /** Optional right-side count badge (e.g. queue job count) */
  badge?: number | string;
}

export interface SidebarNavGroup {
  id: string;
  label?: string;
  items: SidebarNavItem[];
}

export interface SidebarProps {
  appName: string;
  groups: SidebarNavGroup[];
  active: string;
  onSelect: (id: string) => void;
  /** Extra content in the sidebar footer (e.g. user menu) */
  footer?: React.ReactNode;
}

/**
 * Left-rail navigation. Groups items under optional section labels.
 * Collapses to icons on < md; hidden on mobile (toggled via header hamburger).
 */
export function Sidebar({ appName, groups, active, onSelect, footer }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer when selecting
  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      setMobileOpen(false);
    },
    [onSelect],
  );

  // Close on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile trigger — absolute-positioned, sits over content */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        className="md:hidden fixed top-3 left-3 z-30 inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground shadow-sm"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Primary navigation"
        data-fp-sidebar
        className={cn(
          "z-50 flex h-full flex-col border-r border-border bg-background",
          // Desktop: fixed width, always visible
          "md:sticky md:top-0 md:h-screen md:w-60 md:translate-x-0",
          // Mobile: off-canvas overlay
          "fixed inset-y-0 left-0 w-64 transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* Brand */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2 min-w-0">
            <LayoutDashboard className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
            <span className="truncate text-sm font-semibold">{appName}</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="md:hidden inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Groups */}
        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Sections">
          <ul className="space-y-4">
            {groups.map((group) => (
              <li key={group.id}>
                {group.label && (
                  <div className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </div>
                )}
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = item.id === active;
                    const Icon = item.icon;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => handleSelect(item.id)}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                            isActive
                              ? "bg-accent text-accent-foreground font-medium"
                              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                          )}
                        >
                          {Icon && (
                            <Icon
                              className={cn(
                                "h-4 w-4 shrink-0",
                                isActive
                                  ? "text-foreground"
                                  : "text-muted-foreground group-hover:text-foreground",
                              )}
                              aria-hidden="true"
                            />
                          )}
                          <span className="truncate">{item.label}</span>
                          {item.badge !== undefined && (
                            <span
                              className={cn(
                                "ml-auto rounded px-1.5 py-0.5 text-[10px] font-mono",
                                isActive
                                  ? "bg-background/40 text-foreground"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </nav>

        {footer && <div className="shrink-0 border-t border-border p-3">{footer}</div>}
      </aside>
    </>
  );
}

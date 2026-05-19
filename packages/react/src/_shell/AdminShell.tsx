import type * as React from "react";
import { AdminNav, type NavGroup } from "./AdminNav.js";
import { AdminTabs } from "./AdminTabs.js";

export type AdminShellVariant = "sidebar" | "tabs";

export interface AdminShellProps {
  variant?: AdminShellVariant;
  brandName?: string;
  navGroups: NavGroup[];
  currentPath: string;
  children: React.ReactNode;
}

/**
 * Pure visual chrome around FlowPanel content. Two variants:
 *
 * - `sidebar` (default) — full-height left sidebar + content area. Suited to
 *   standalone admins where FlowPanel owns the whole page.
 * - `tabs` — horizontal tab strip above content. Suited to embedded admins
 *   where the host app already provides a header.
 *
 * Context providers (theme components, labels, toasts) live in
 * `<FlowpanelGlobals>` so `bare` mode (no shell at all) still has them.
 */
export function AdminShell({
  variant = "sidebar",
  brandName,
  navGroups,
  currentPath,
  children,
}: AdminShellProps) {
  const skipLink = (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-fp-sm focus:bg-fp-accent focus:px-3 focus:py-1 focus:text-fp-accent-text"
    >
      Skip to main content
    </a>
  );

  if (variant === "tabs") {
    return (
      <div className="min-h-screen bg-fp-bg-2 text-fp-text-1 antialiased font-sans">
        {skipLink}
        <AdminTabs
          groups={navGroups}
          currentPath={currentPath}
          {...(brandName !== undefined ? { brandName } : {})}
        />
        <main id="main" className="mx-auto max-w-7xl px-6 py-6">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-fp-bg-2 text-fp-text-1 antialiased font-sans">
      <AdminNav
        groups={navGroups}
        currentPath={currentPath}
        {...(brandName !== undefined ? { brandName } : {})}
      />
      <main id="main" className="flex-1 overflow-auto">
        {skipLink}
        <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
      </main>
    </div>
  );
}

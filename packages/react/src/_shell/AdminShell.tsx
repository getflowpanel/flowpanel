"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu } from "lucide-react";
import * as React from "react";
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
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // Close mobile drawer when route changes (navigation completes).
  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [currentPath]);

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
    <div className="flex h-screen flex-col bg-fp-bg-2 text-fp-text-1 antialiased font-sans md:flex-row">
      {/* Mobile top bar: visible below md, hidden md+. */}
      <div className="flex shrink-0 items-center gap-2 border-b border-fp-border-1 bg-fp-bg-1 px-3 py-2 md:hidden">
        <DialogPrimitive.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <DialogPrimitive.Trigger
            aria-label="Open navigation"
            className="inline-flex h-9 w-9 items-center justify-center rounded-fp-sm text-fp-text-2 hover:bg-fp-bg-2 focus:outline-none focus:ring-2 focus:ring-fp-accent"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </DialogPrimitive.Trigger>
          <span className="text-sm font-semibold text-fp-text-1">{brandName ?? "Admin"}</span>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-[fp-fade-in_var(--fp-duration)_var(--fp-ease-out)] data-[state=closed]:animate-[fp-fade-out_var(--fp-duration)_var(--fp-ease-out)]" />
            <DialogPrimitive.Content
              aria-describedby={undefined}
              className="fixed left-0 top-0 z-50 flex h-dvh w-[min(80vw,288px)] flex-col bg-fp-bg-1 shadow-xl focus:outline-none data-[state=open]:animate-[fp-fade-in_var(--fp-duration)_var(--fp-ease-out)] data-[state=closed]:animate-[fp-fade-out_var(--fp-duration)_var(--fp-ease-out)]"
            >
              <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
              <AdminNav
                groups={navGroups}
                currentPath={currentPath}
                {...(brandName !== undefined ? { brandName } : {})}
              />
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
      {/* Desktop inline sidebar: hidden below md, shown md+. */}
      <div className="hidden md:block md:h-full">
        <AdminNav
          groups={navGroups}
          currentPath={currentPath}
          {...(brandName !== undefined ? { brandName } : {})}
        />
      </div>
      <main id="main" className="flex-1 overflow-auto">
        {skipLink}
        <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
      </main>
    </div>
  );
}

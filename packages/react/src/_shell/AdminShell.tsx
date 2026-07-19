"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu } from "lucide-react";
import * as React from "react";
import { AccountMenu, type AccountMenuUser } from "./AccountMenu.js";
import { AdminNav, type NavGroup } from "./AdminNav.js";
import { AdminTabs } from "./AdminTabs.js";
import { Brand, type ShellBrand } from "./Brand.js";

export type AdminShellVariant = "sidebar" | "tabs";

export interface AdminShellProps {
  variant?: AdminShellVariant;
  brand?: ShellBrand;
  user?: AccountMenuUser;
  navGroups: NavGroup[];
  currentPath: string;
  children: React.ReactNode;
}

/** Pure visual chrome around FlowPanel content. */
export function AdminShell({
  variant = "sidebar",
  brand,
  user,
  navGroups,
  currentPath,
  children,
}: AdminShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: currentPath is the intentional trigger — the effect re-runs to dismiss the drawer whenever the route changes.
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
      <div className="min-h-screen bg-fp-bg-2 font-fp-sans text-fp-text-1 antialiased">
        {skipLink}
        <AdminTabs
          groups={navGroups}
          currentPath={currentPath}
          {...(brand !== undefined ? { brand } : {})}
          {...(user !== undefined ? { user } : {})}
        />
        <main id="main" className="mx-auto max-w-7xl px-6 py-6">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-fp-bg-2 font-fp-sans text-fp-text-1 antialiased md:flex-row">
      {skipLink}
      <div className="flex shrink-0 items-center gap-2 border-b border-fp-border-1 bg-fp-bg-1 px-3 py-2 md:hidden">
        <DialogPrimitive.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <DialogPrimitive.Trigger
            aria-label="Open navigation"
            className="inline-flex h-9 w-9 items-center justify-center rounded-fp-sm text-fp-text-2 transition-colors hover:bg-fp-bg-3/70 hover:text-fp-text-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/40"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </DialogPrimitive.Trigger>
          <Brand brand={brand} className="min-w-0 flex-1" />
          {user ? <AccountMenu user={user} align="end" className="w-auto" /> : null}
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fp-anim-overlay fixed inset-0 z-50 bg-fp-overlay/60 backdrop-blur-[2px]" />
            <DialogPrimitive.Content
              aria-describedby={undefined}
              className="fp-anim-sheet-left fixed left-0 top-0 z-50 flex h-dvh w-[min(80vw,288px)] flex-col border-r border-fp-border-1 bg-fp-bg-1 shadow-fp-lg focus:outline-none"
            >
              <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
              <AdminNav
                groups={navGroups}
                currentPath={currentPath}
                {...(brand !== undefined ? { brand } : {})}
                {...(user !== undefined ? { user } : {})}
              />
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
      <div className="hidden md:block md:h-full">
        <AdminNav
          groups={navGroups}
          currentPath={currentPath}
          {...(brand !== undefined ? { brand } : {})}
          {...(user !== undefined ? { user } : {})}
        />
      </div>
      <main id="main" className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
      </main>
    </div>
  );
}

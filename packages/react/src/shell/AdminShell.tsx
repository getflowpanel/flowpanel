"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu } from "lucide-react";
import * as React from "react";
import { useLabels } from "../provider/LabelsContext";
import { AccountMenu, type AccountMenuUser } from "./AccountMenu";
import { AdminNav, type NavGroup } from "./AdminNav";
import { AdminTabs } from "./AdminTabs";
import { Brand, type ShellBrand } from "./Brand";

export type AdminShellVariant = "sidebar" | "tabs";

export interface AdminShellProps {
  variant?: AdminShellVariant;
  brand?: ShellBrand;
  user?: AccountMenuUser;
  navGroups: NavGroup[];
  currentPath: string;
  /** The admin's mount path; its nav entry is active only on that page. Inferred from the entries when unset. */
  rootHref?: string;
  /** Set false when the host layout already provides the page's skip link. */
  showSkipLink?: boolean;
  children: React.ReactNode;
}

/** In the sidebar layout `main` scrolls, and only its own bottom padding sits below a list. */
const SIDEBAR_MAIN_STYLE: React.CSSProperties & { "--fp-below": string } = {
  "--fp-below": "1.5rem",
};

/** Pure visual chrome around FlowPanel content. */
export function AdminShell({
  variant = "sidebar",
  brand,
  user,
  navGroups,
  currentPath,
  rootHref,
  showSkipLink = true,
  children,
}: AdminShellProps) {
  const { navigation } = useLabels();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: currentPath is the intentional trigger — the effect re-runs to dismiss the drawer whenever the route changes.
  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [currentPath]);

  // List tables cap their scroller by the tab bar above and whatever the page puts below the admin.
  const tabsShellRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const shell = tabsShellRef.current;
    const nav = shell?.querySelector<HTMLElement>("nav[data-flowpanel-nav]");
    const main = shell?.querySelector<HTMLElement>("main");
    if (!shell || !nav || !main || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const contentEnd =
        main.getBoundingClientRect().bottom +
        window.scrollY -
        parseFloat(getComputedStyle(main).paddingBottom);
      const below = Math.max(0, document.documentElement.scrollHeight - contentEnd);
      shell.style.setProperty("--fp-sticky-top", `${nav.offsetHeight}px`);
      shell.style.setProperty("--fp-below", `${Math.round(below)}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    observer.observe(main);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  const skipLink = (
    <a
      href="#main"
      className="fp-sr-only focus:fp-not-sr-only focus:fp-absolute focus:fp-left-2 focus:fp-top-2 focus:fp-z-50 focus:fp-rounded-sm focus:fp-bg-accent focus:fp-px-3 focus:fp-py-1 focus:fp-text-on-accent"
    >
      {navigation.skipToContent}
    </a>
  );

  if (variant === "tabs") {
    return (
      <div
        ref={tabsShellRef}
        className="fp-min-h-screen fp-bg-canvas fp-font-sans fp-text-ink fp-antialiased"
      >
        {showSkipLink ? skipLink : null}
        <AdminTabs
          groups={navGroups}
          currentPath={currentPath}
          rootHref={rootHref}
          {...(brand !== undefined ? { brand } : {})}
          {...(user !== undefined ? { user } : {})}
        />
        <main id="main" className="fp-mx-auto fp-max-w-[103rem] fp-px-6 fp-py-6">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="fp-flex fp-h-screen fp-flex-col fp-bg-canvas fp-font-sans fp-text-ink fp-antialiased md:fp-flex-row">
      {showSkipLink ? skipLink : null}
      <div className="fp-flex fp-shrink-0 fp-items-center fp-gap-2 fp-border-b fp-border-line fp-bg-surface fp-px-3 fp-py-2 md:fp-hidden">
        <DialogPrimitive.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <DialogPrimitive.Trigger
            aria-label={navigation.open}
            className="fp-inline-flex fp-h-11 fp-w-11 fp-items-center fp-justify-center fp-rounded-sm fp-text-soft fp-transition-colors hover:fp-bg-fill/70 hover:fp-text-ink focus:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60"
          >
            <Menu className="fp-h-5 fp-w-5" aria-hidden="true" />
          </DialogPrimitive.Trigger>
          <Brand brand={brand} fallback={navigation.admin} className="fp-min-w-0 fp-flex-1" />
          {user ? <AccountMenu user={user} align="end" className="fp-w-auto" /> : null}
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay
              data-flowpanel-portal=""
              className="fp-anim-overlay fp-fixed fp-inset-0 fp-z-50 fp-bg-overlay/60 fp-backdrop-blur-[2px]"
            />
            <DialogPrimitive.Content
              data-flowpanel-portal=""
              aria-describedby={undefined}
              className="fp-anim-sheet-left fp-fixed fp-left-0 fp-top-0 fp-z-50 fp-flex fp-h-dvh fp-w-[min(80vw,288px)] fp-flex-col fp-border-r fp-border-line fp-bg-surface fp-shadow-lg focus:fp-outline-none"
            >
              <DialogPrimitive.Title className="fp-sr-only">
                {navigation.title}
              </DialogPrimitive.Title>
              <AdminNav
                groups={navGroups}
                currentPath={currentPath}
                rootHref={rootHref}
                {...(brand !== undefined ? { brand } : {})}
                {...(user !== undefined ? { user } : {})}
              />
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
      <div className="fp-hidden md:fp-block md:fp-h-full">
        <AdminNav
          groups={navGroups}
          currentPath={currentPath}
          rootHref={rootHref}
          {...(brand !== undefined ? { brand } : {})}
          {...(user !== undefined ? { user } : {})}
        />
      </div>
      <main id="main" className="fp-flex-1 fp-overflow-auto" style={SIDEBAR_MAIN_STYLE}>
        <div className="fp-mx-auto fp-max-w-[103rem] fp-px-6 fp-py-6">{children}</div>
      </main>
    </div>
  );
}

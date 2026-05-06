import type * as React from "react";
import { ToastProvider } from "../_feedback/Toast.js";
import { AdminNav, type NavGroup } from "./AdminNav.js";

export interface AdminShellProps {
  brandName?: string;
  navGroups: NavGroup[];
  currentPath: string;
  children: React.ReactNode;
}

export function AdminShell({ brandName, navGroups, currentPath, children }: AdminShellProps) {
  return (
    <ToastProvider>
      <div className="flex h-screen bg-fp-bg-2 text-fp-text-1 antialiased font-sans">
        <AdminNav
          groups={navGroups}
          currentPath={currentPath}
          {...(brandName !== undefined ? { brandName } : {})}
        />
        <main id="main" className="flex-1 overflow-auto">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-fp-sm focus:bg-fp-accent focus:px-3 focus:py-1 focus:text-fp-accent-text"
          >
            Skip to main content
          </a>
          <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}

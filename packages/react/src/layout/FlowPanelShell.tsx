"use client";

import type { ReactNode } from "react";
import { Toaster } from "../ui/sonner";
import { Sidebar, type SidebarNavGroup } from "./Sidebar";
import { ShellHeader } from "./ShellHeader";

export interface FlowPanelShellProps {
  appName: string;
  nav: SidebarNavGroup[];
  activeKey: string;
  onNavigate: (key: string) => void;
  /** Rendered inside the header (right side): e.g. time range, live status, palette trigger */
  headerRight?: ReactNode;
  /** Rendered in the sidebar footer (e.g. user menu) */
  sidebarFooter?: ReactNode;
  /** Rendered as the main content */
  children: ReactNode;
}

/**
 * Primary layout shell: sidebar + header + main content + toaster.
 * Uses shadcn primitives and Tailwind. Replaces the older tabs-strip layout.
 */
export function FlowPanelShell({
  appName,
  nav,
  activeKey,
  onNavigate,
  headerRight,
  sidebarFooter,
  children,
}: FlowPanelShellProps) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar
        appName={appName}
        groups={nav}
        active={activeKey}
        onSelect={onNavigate}
        footer={sidebarFooter}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <ShellHeader right={headerRight} />
        <main id="fp-main" className="flex-1 overflow-x-hidden px-4 py-6 md:px-6 lg:px-8">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}

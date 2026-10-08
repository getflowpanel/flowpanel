import { ThemeScript } from "@flowpanel/kit/react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DEMO_ROLE_COOKIE, toDemoRole } from "@/src/demo/auth/role";
import { demoLinks } from "@/src/demo/links";
import { isEnabledFlag } from "@/src/demo/sandbox/config";
import { DemoPersonaGuide } from "@/src/demo/ui/DemoPersonaGuide";
import { DemoSandboxNotice } from "@/src/demo/ui/DemoSandboxNotice";
import "./globals.css";

export const metadata: Metadata = {
  title: { template: "%s — ScrapeAI", default: "ScrapeAI" },
  description: "Competitive price-intelligence operations, built with FlowPanel",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const demoMode = isEnabledFlag(process.env.DEMO_MODE);
  const readOnly = isEnabledFlag(process.env.DEMO_READ_ONLY);
  const role = toDemoRole((await cookies()).get(DEMO_ROLE_COOKIE)?.value);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript defaultMode="auto" />
      </head>
      <body className="flex min-h-screen flex-col bg-demo-page text-demo-text antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-sm focus:bg-demo-accent focus:px-3 focus:py-2 focus:text-demo-accent-text"
        >
          Skip to main content
        </a>

        <DemoPersonaGuide role={role} />
        {demoMode ? <DemoSandboxNotice readOnly={readOnly} /> : null}

        <div className="flex-1">{children}</div>

        <footer className="border-t border-demo-border bg-demo-surface">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 text-xs text-demo-subtle sm:px-6">
            <span>Built with FlowPanel.</span>
            <a
              href={demoLinks.config}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-demo-muted hover:text-demo-text"
            >
              View config
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}

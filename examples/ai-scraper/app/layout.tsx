import { ThemeScript } from "@flowpanel/kit/react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DEMO_ROLE_COOKIE, toDemoRole } from "@/src/demo/auth/role";
import { isEnabledFlag } from "@/src/demo/sandbox/config";
import { DemoPersonaGuide } from "@/src/demo/ui/DemoPersonaGuide";
import { DemoSandboxNotice } from "@/src/demo/ui/DemoSandboxNotice";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScrapeAI — FlowPanel demo",
  description: "Competitive price-intelligence operations, built with FlowPanel",
};

const REPO = "https://github.com/getflowpanel/flowpanel";
const SOURCE = `${REPO}/tree/main/examples/ai-scraper`;
const CONFIG = `${SOURCE}/src/admin/config`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const demoMode = isEnabledFlag(process.env.DEMO_MODE);
  const readOnly = isEnabledFlag(process.env.DEMO_READ_ONLY);
  const role = toDemoRole((await cookies()).get(DEMO_ROLE_COOKIE)?.value);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript defaultMode="auto" />
      </head>
      <body
        data-flowpanel-root=""
        className="flex min-h-screen flex-col bg-fp-bg-2 text-fp-text-1 antialiased"
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-fp-sm focus:bg-fp-accent focus:px-3 focus:py-2 focus:text-fp-accent-text"
        >
          Skip to main content
        </a>

        <DemoPersonaGuide role={role} />
        {demoMode ? <DemoSandboxNotice readOnly={readOnly} /> : null}

        <div className="flex-1">{children}</div>

        <footer className="border-t border-fp-border-1 bg-fp-bg-1">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 text-xs text-fp-text-3 sm:px-6">
            <span>Built with FlowPanel.</span>
            <a
              href={CONFIG}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-fp-text-2 hover:text-fp-text-1"
            >
              View config
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}

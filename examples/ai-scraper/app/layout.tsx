import { ThemeScript } from "@flowpanel/kit/react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DEMO_ROLE_COOKIE } from "@/src/demo/auth/role";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScrapeAI — Flowpanel demo",
  description: "Competitive price-intelligence operations, built with Flowpanel",
};

const REPO = "https://github.com/getflowpanel/flowpanel";
const SOURCE = `${REPO}/tree/main/examples/ai-scraper`;
const CONFIG = `${SOURCE}/src/admin/config`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const demoMode = process.env.DEMO_MODE === "true";
  const role = (await cookies()).get(DEMO_ROLE_COOKIE)?.value === "support" ? "support" : "admin";

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

        {demoMode ? (
          <div
            role="status"
            className="border-b border-fp-border-1 bg-fp-bg-1 px-4 py-2 text-center text-xs text-fp-text-2"
          >
            Public sandbox · Data resets hourly · Editing is disabled
          </div>
        ) : null}

        <header className="border-b border-fp-border-1 bg-fp-bg-1">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:min-h-14 sm:flex-nowrap sm:px-6">
            <div className="flex w-full min-w-0 items-baseline gap-3 sm:w-auto">
              <span className="text-sm font-semibold text-fp-text-1">ScrapeAI</span>
              <span className="truncate text-xs text-fp-text-3">
                Competitive price intelligence
              </span>
            </div>

            <div className="flex w-full items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:justify-end">
              <fieldset className="flex items-center rounded-fp border border-fp-border-1 bg-fp-bg-2 p-0.5">
                <legend className="sr-only">Demo persona</legend>
                {(["admin", "support"] as const).map((persona) => (
                  <form action="/api/demo/role" method="post" key={persona}>
                    <input type="hidden" name="role" value={persona} />
                    <button
                      type="submit"
                      aria-pressed={role === persona}
                      className={`min-h-11 rounded-fp-sm px-3 py-2 text-xs font-medium capitalize sm:min-h-9 ${
                        role === persona
                          ? "bg-fp-bg-1 text-fp-text-1 shadow-sm"
                          : "text-fp-text-3 hover:text-fp-text-1"
                      }`}
                    >
                      {persona}
                    </button>
                  </form>
                ))}
              </fieldset>
              <a
                href={SOURCE}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center px-2 text-xs font-medium text-fp-text-2 hover:text-fp-text-1 sm:min-h-9"
              >
                Source
              </a>
            </div>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="border-t border-fp-border-1 bg-fp-bg-1">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 text-xs text-fp-text-3 sm:px-6">
            <span>Built with Flowpanel.</span>
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

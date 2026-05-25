import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "freelance-radar — FlowPanel demo",
  description: "Real-data admin for a freelance job radar SaaS",
};

/**
 * Root layout demonstrates the embedded-admin scenario: the host app owns
 * the global header / brand / theme switcher, and FlowPanel renders only a
 * tabs strip + content beneath it. See `flowpanel.config.ts` for the
 * matching `shell: "tabs"` setting.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const demoMode = process.env.DEMO_MODE === "true";
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-fp-bg-2 text-fp-text-1 antialiased">
        {demoMode ? (
          <div
            role="status"
            className="border-b border-fp-border-1 bg-fp-accent/10 px-6 py-2 text-center text-xs text-fp-text-1"
          >
            <span aria-hidden className="mr-1">
              🧪
            </span>
            Public demo — data resets every hour. Actions are read-only.{" "}
            <a
              href="https://github.com/getflowpanel/flowpanel"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-fp-accent"
            >
              View source on GitHub →
            </a>
          </div>
        ) : null}
        <header className="border-b border-fp-border-1 bg-fp-bg-1">
          <div className="mx-auto flex h-12 max-w-7xl items-center gap-3 px-6">
            <span className="text-sm font-semibold text-fp-text-1">Acme&nbsp;Co</span>
            <span aria-hidden className="text-fp-text-3">
              ·
            </span>
            <span className="text-sm text-fp-text-2">FreelanceRadar</span>
            <span className="ml-auto rounded-full border border-fp-border-1 px-2 py-0.5 text-xs text-fp-text-3">
              {demoMode ? "Demo" : "Production"}
            </span>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}

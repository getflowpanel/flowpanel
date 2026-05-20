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
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-fp-bg-2 text-fp-text-1 antialiased">
        <header className="border-b border-fp-border-1 bg-fp-bg-1">
          <div className="mx-auto flex h-12 max-w-7xl items-center gap-3 px-6">
            <span className="text-sm font-semibold text-fp-text-1">Acme&nbsp;Co</span>
            <span aria-hidden className="text-fp-text-3">
              ·
            </span>
            <span className="text-sm text-fp-text-2">FreelanceRadar</span>
            <span className="ml-auto rounded-full border border-fp-border-1 px-2 py-0.5 text-xs text-fp-text-3">
              Production
            </span>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}

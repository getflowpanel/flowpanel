import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScrapeAI — FlowPanel demo",
  description: "Ops admin for a price & product intelligence SaaS, built with FlowPanel",
};

const REPO = "https://github.com/getflowpanel/flowpanel";
const CONFIG_URL = `${REPO}/tree/main/examples/ai-scraper/src/admin/config`;

/** Repo star count, cached for an hour. Best-effort — `null` on any failure. */
async function getStars(): Promise<number | null> {
  try {
    const r = await fetch("https://api.github.com/repos/getflowpanel/flowpanel", {
      next: { revalidate: 3600 },
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { stargazers_count?: number };
    return typeof j.stargazers_count === "number" ? j.stargazers_count : null;
  } catch {
    return null;
  }
}

const fmtStars = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/** GitHub "star" button with a live (cached) star count. */
function GitHubStar({ stars }: { stars: number | null }) {
  return (
    <a
      href={REPO}
      target="_blank"
      rel="noreferrer"
      aria-label="Star FlowPanel on GitHub"
      className="inline-flex items-center gap-1.5 rounded-fp border border-fp-border-1 bg-fp-bg-1 px-2.5 py-1 text-xs font-medium text-fp-text-2 transition-colors hover:bg-fp-bg-2 hover:text-fp-text-1"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" role="img">
        <title>GitHub</title>
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
      </svg>
      <span>Star</span>
      <span aria-hidden className="text-fp-warn">
        ★
      </span>
      {stars != null ? (
        <span className="tabular-nums text-fp-text-3">{fmtStars(stars)}</span>
      ) : null}
    </a>
  );
}

/**
 * Root layout — the host app owns the global chrome (header / footer) and
 * FlowPanel renders only a tabs strip + content beneath it (see the matching
 * `shell: "tabs"` in `src/admin/config`). The header and footer also tie the
 * fictional product back to FlowPanel: a GitHub star button + a "built with"
 * footer that links straight to the config folder behind the whole admin.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const demoMode = process.env.DEMO_MODE === "true";
  const stars = await getStars();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-fp-bg-2 text-fp-text-1 antialiased">
        {/* The host app owns everything above FlowPanel's content — the demo-mode
            banner, the marketing header, the "Star on GitHub" link — so it must
            also own the page's bypass-blocks mechanism (WCAG 2.4.1). AdminShell
            renders its own skip link too, but that one lives inside `{children}`,
            after this header; a keyboard user's very first Tab needs to land here
            instead. Both skip links target `#main`, so they compose fine — this
            one just gets there first. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-fp-sm focus:bg-fp-accent focus:px-3 focus:py-1 focus:text-fp-accent-text"
        >
          Skip to main content
        </a>
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
              href={REPO}
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
            <span className="text-sm font-semibold text-fp-text-1">ScrapeAI</span>
            <span aria-hidden className="text-fp-text-3">
              ·
            </span>
            <span className="text-sm text-fp-text-2">Console</span>
            <div className="ml-auto flex items-center gap-2">
              {demoMode ? (
                <span className="rounded-full border border-fp-border-1 px-2 py-0.5 text-xs text-fp-text-3">
                  Demo
                </span>
              ) : null}
              <GitHubStar stars={stars} />
            </div>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-fp-border-1 bg-fp-bg-1">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-4 text-xs text-fp-text-3 sm:flex-row">
            <span>
              Built with{" "}
              <a
                href={REPO}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-fp-text-1 hover:text-fp-accent"
              >
                FlowPanel
              </a>{" "}
              — the whole admin is one config folder.
            </span>
            <a
              href={CONFIG_URL}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 hover:text-fp-accent hover:underline"
            >
              Browse the config →
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}

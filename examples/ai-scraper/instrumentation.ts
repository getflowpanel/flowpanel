/**
 * Next.js startup hook — runs once when the server process boots.
 *
 * We use it to start the in-memory live activity ticker (`src/lib/live-feed.ts`)
 * that drives the dashboard's realtime feed and throughput counters. Guarded to
 * the Node.js runtime (not Edge) and skippable via `DEMO_LIVE=off`.
 *
 * Note: the ticker lives in this one long-running process, so a live demo needs
 * a persistent Node host (Railway / Coolify / Fly) — not serverless functions,
 * which sleep between requests and would freeze the feed.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DEMO_LIVE !== "off") {
    const { startLiveFeed } = await import("@/src/lib/live-feed");
    startLiveFeed();
  }
}

/**
 * Next.js startup hook — runs once when the server process boots.
 *
 * We use it to start the in-memory market activity ticker in `src/demo`.
 * It drives the dashboard's realtime example and is guarded to
 * the Node.js runtime (not Edge) and skippable via `DEMO_LIVE=off`.
 *
 * Note: the ticker lives in this one long-running process, so a live demo needs
 * a persistent Node host (Railway / Coolify / Fly) — not serverless functions,
 * which sleep between requests and would freeze the feed.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DEMO_LIVE !== "off") {
    const { bindPublisher } = await import("@flowpanel/kit/next");
    const { default: config } = await import("@/src/admin/config");
    bindPublisher(config);
    const { startLiveOperationsTicker } = await import("@/src/demo/realtime/feed");
    startLiveOperationsTicker();
  }
}

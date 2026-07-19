"use client";
import { TimeAgo, useLiveChannel } from "@flowpanel/kit/react";
import { useState } from "react";
import { type FeedEvent, LIVE_CHANNEL, type LivePayload } from "@/src/lib/live-types";
import { LiveDot } from "./LiveDot";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const money = (cents: number) => usd.format(cents / 100);

/**
 * Append-only live activity feed. Initial rows are server-rendered (so the
 * panel is full on first paint); subsequent rows arrive over FlowPanel's
 * `useLiveChannel` SSE hook and are prepended at the top with a fade-in.
 * The list is a fixed-height scroll area, so new rows never shift the page
 * content below it.
 */
export function LiveFeed({ recent }: { recent: FeedEvent[] }) {
  const [events, setEvents] = useState<FeedEvent[]>(recent);
  const status = useLiveChannel(LIVE_CHANNEL, (payload) => {
    const p = payload as LivePayload | undefined;
    if (p?.recent) setEvents(p.recent);
  });
  const live = status === "live";

  return (
    // Fixed card height + a flex-fill scrolling body: the feed's footprint never
    // changes as rows come and go, so nothing below it on the page shifts.
    <div
      className="no-scroll-anchor flex flex-col overflow-hidden rounded-fp border border-fp-border-1 bg-fp-bg-1"
      style={{ height: 440 }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-fp-border-1 px-4 py-3">
        <h3 className="text-sm font-semibold text-fp-text-1">Live activity</h3>
        <LiveDot live={live} />
      </div>
      <ul
        // Scrollable with no focusable descendant, so the container itself must
        // be a tab stop or a keyboard user can never scroll it (WCAG 2.1.1).
        // biome-ignore lint/a11y/noNoninteractiveTabindex: intentional, see above.
        tabIndex={0}
        aria-label="Live activity feed, scrollable"
        className="no-scroll-anchor min-h-0 flex-1 divide-y divide-fp-border-1 overflow-y-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fp-accent"
      >
        {events.map((e, i) => (
          <li
            key={e.id}
            className={`flex items-center gap-3 px-4 py-2.5 ${i === 0 ? "feed-row-enter" : ""}`}
          >
            <span
              className={`inline-flex w-14 shrink-0 justify-center rounded-fp-sm px-1.5 py-1 text-xs font-semibold tabular-nums ${
                e.direction === "drop"
                  ? "bg-fp-ok/10 text-fp-ok-text"
                  : "bg-fp-warn/10 text-fp-warn-text"
              }`}
            >
              {e.pctDelta > 0 ? "+" : ""}
              {e.pctDelta}%
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium text-fp-text-1">{e.title}</span>
                <span className="shrink-0 text-xs tabular-nums text-fp-text-3">
                  <TimeAgo date={new Date(e.at)} tickMs={1_000} />
                </span>
              </div>
              <div className="mt-0.5 truncate text-xs text-fp-text-3">
                {e.site} · <span className="text-fp-text-2">{money(e.oldPriceCents)}</span> →{" "}
                <span className="text-fp-text-1">{money(e.newPriceCents)}</span> ·{" "}
                {e.stock.replace(/_/g, " ")}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

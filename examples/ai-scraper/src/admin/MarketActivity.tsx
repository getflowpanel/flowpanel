"use client";

import { TimeAgo, useLiveChannel } from "@flowpanel/kit/react";
import { useState } from "react";
import {
  MARKET_ACTIVITY_CHANNEL,
  type MarketActivityProps,
  type MarketActivitySnapshot,
} from "@/src/demo/realtime/types";

const number = new Intl.NumberFormat("en-US");
const eventLabel = {
  price_drop: "Price drop",
  price_rise: "Price rise",
  stock_change: "Stock change",
  crawl_completed: "Crawl complete",
} as const;

export function MarketActivity({ initial }: MarketActivityProps) {
  const [activity, setActivity] = useState(initial);
  const status = useLiveChannel(MARKET_ACTIVITY_CHANNEL, (payload) => {
    const next = payload as MarketActivitySnapshot | undefined;
    if (next?.events) setActivity(next);
  });
  const connected = status === "live";

  return (
    <section aria-labelledby="market-activity-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="market-activity-title" className="text-sm font-semibold text-fp-text-1">
            Market activity
          </h3>
          <p className="mt-1 text-xs text-fp-text-3">
            Synthetic events from monitored marketplaces
          </p>
        </div>
        <span aria-live="polite" className="text-xs font-medium text-fp-text-2">
          {connected ? "Live" : "Connecting…"}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 border-y border-fp-border-1 py-3">
        <div>
          <dt className="text-xs text-fp-text-3">Offers / min</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-fp-text-1">
            {number.format(activity.offersPerMinute)}
          </dd>
        </div>
        <div className="border-l border-fp-border-1 pl-4">
          <dt className="text-xs text-fp-text-3">Active monitors</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-fp-text-1">
            {number.format(activity.activeMonitors)}
          </dd>
        </div>
      </dl>

      <ol
        aria-live="polite"
        aria-label="Latest market events"
        className="divide-y divide-fp-border-1"
      >
        {activity.events.map((event, index) => (
          <li
            key={event.id}
            data-market-event-id={event.id}
            className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 py-3"
          >
            <span className="truncate text-sm font-medium text-fp-text-1">{event.title}</span>
            <span className="text-xs tabular-nums text-fp-text-3">
              <TimeAgo date={new Date(event.at)} tickMs={1_000} />
            </span>
            <span className="truncate text-xs text-fp-text-3">
              {event.marketplace} · {eventLabel[event.kind]} · {event.detail}
            </span>
            {index === 0 ? <span className="text-xs text-fp-text-2">Latest</span> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

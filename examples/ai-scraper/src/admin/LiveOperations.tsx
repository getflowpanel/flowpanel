"use client";

import { AreaChart } from "@flowpanel/kit/charts/runtime";
import { LiveIndicator, TimeAgo, useLiveChannel } from "@flowpanel/kit/react";
import { useMemo, useState } from "react";
import {
  LIVE_OPERATIONS_CHANNEL,
  LIVE_OPERATIONS_INTERVAL_MS,
  type LiveOperationsProps,
  type LiveOperationsSnapshot,
} from "@/src/demo/realtime/types";

const number = new Intl.NumberFormat("en-US");
const chartOptions = {
  x: "time",
  y: "rate",
  height: 210,
  smooth: false,
  tooltip: "compact",
} as const;
const eventLabel = {
  price_drop: "Price drop",
  price_rise: "Price rise",
  stock_change: "Stock change",
  crawl_completed: "Crawl complete",
} as const;

function LiveStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <dt className="truncate text-xs text-fp-text-3">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums text-fp-text-1">
        {value}
      </dd>
    </div>
  );
}

export function LiveOperations({ initial }: LiveOperationsProps) {
  const [activity, setActivity] = useState(initial);
  const status = useLiveChannel(LIVE_OPERATIONS_CHANNEL, (payload) => {
    const next = payload as LiveOperationsSnapshot | undefined;
    if (next?.events) setActivity(next);
  });
  const chartData = useMemo(() => {
    const latest = activity.throughputHistory.length - 1;
    return activity.throughputHistory.map((rate, index) => {
      const secondsAgo = (latest - index) * (LIVE_OPERATIONS_INTERVAL_MS / 1_000);
      return { time: secondsAgo === 0 ? "now" : `−${secondsAgo}s`, rate };
    });
  }, [activity.throughputHistory]);

  return (
    <section
      aria-labelledby="live-operations-title"
      className="overflow-hidden rounded-fp-lg border border-fp-border-1 bg-fp-bg-1 shadow-fp-xs"
    >
      <header className="flex items-start justify-between gap-4 border-b border-fp-border-1 px-4 py-3">
        <div>
          <h2 id="live-operations-title" className="text-sm font-semibold text-fp-text-1">
            Live operations
          </h2>
          <p className="mt-0.5 text-xs text-fp-text-3">
            Crawl throughput and marketplace changes as they happen
          </p>
        </div>
        <LiveIndicator status={status} className="mt-0.5 shrink-0" />
      </header>

      <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(19rem,0.9fr)]">
        <div className="min-w-0 lg:border-r lg:border-fp-border-1">
          <div className="flex items-center justify-between gap-4 px-4 py-2.5">
            <h3 className="text-sm font-medium text-fp-text-1">Throughput</h3>
            <span className="text-xs tabular-nums text-fp-text-3">Last 70 seconds</span>
          </div>
          <dl className="grid grid-cols-2 divide-x divide-y divide-fp-border-1 border-y border-fp-border-1 sm:grid-cols-4 sm:divide-y-0">
            <LiveStat label="Offers / min" value={number.format(activity.offersPerMinute)} />
            <LiveStat
              label="Price changes today"
              value={number.format(activity.priceChangesToday)}
            />
            <LiveStat label="Concurrent crawls" value={number.format(activity.concurrentCrawls)} />
            <LiveStat
              label="Avg match latency"
              value={`${(activity.avgMatchLatencyMs / 1_000).toFixed(1)} s`}
            />
          </dl>
          <div className="px-2 pt-3 pb-2">
            <p className="px-2 text-xs text-fp-text-3">Crawl rate · offers / min</p>
            <AreaChart data={chartData} options={chartOptions} />
          </div>
        </div>

        <div className="min-w-0 border-t border-fp-border-1 lg:border-t-0">
          <div className="px-4 py-2.5">
            <h3 className="text-sm font-medium text-fp-text-1">Market activity</h3>
            <p className="mt-0.5 text-xs text-fp-text-3">Latest changes across monitored stores</p>
          </div>
          <ol
            aria-label="Latest market events"
            className="divide-y divide-fp-border-1 border-t border-fp-border-1 px-4"
          >
            {activity.events.slice(0, 4).map((event) => (
              <li
                key={event.id}
                data-market-event-id={event.id}
                className="grid grid-cols-[minmax(0,1fr)_6.75rem] gap-x-3 gap-y-1 py-3"
              >
                <span
                  data-market-event-title
                  className="truncate text-sm font-medium text-fp-text-1"
                  title={event.title}
                >
                  {event.title}
                </span>
                <span className="w-[6.75rem] whitespace-nowrap text-right text-xs tabular-nums text-fp-text-3">
                  <TimeAgo date={new Date(event.at)} tickMs={1_000} />
                </span>
                <span className="col-span-2 truncate text-xs text-fp-text-3">
                  {event.marketplace} · {eventLabel[event.kind]} · {event.detail}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

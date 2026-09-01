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
  height: 180,
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
    <div className="min-w-0 rounded-fp bg-fp-bg-2 px-3 py-3">
      <dt className="truncate text-xs text-fp-text-3">{label}</dt>
      <dd className="mt-2 text-xl font-semibold tracking-[-0.025em] tabular-nums text-fp-text-1">
        {value}
      </dd>
    </div>
  );
}

export function LiveOperations({
  initial,
  queueHref,
}: LiveOperationsProps & { queueHref?: string }) {
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
      className="overflow-hidden rounded-fp-xl border border-fp-border-1 bg-fp-bg-1 shadow-fp-sm"
    >
      <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
        <div>
          <h2 id="live-operations-title" className="text-sm font-semibold text-fp-text-1">
            Live operations
          </h2>
          <p className="mt-1 text-xs text-fp-text-3">
            Crawl throughput and marketplace changes as they happen
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {queueHref ? (
            <a
              href={queueHref}
              className="inline-flex min-h-9 items-center text-xs font-medium text-fp-text-2 hover:text-fp-text-1"
            >
              Queue boards
            </a>
          ) : null}
          <LiveIndicator status={status} className="shrink-0" />
        </div>
      </header>

      <div className="grid gap-5 px-5 pb-5 lg:grid-cols-[minmax(0,2fr)_minmax(19rem,0.9fr)]">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-4 pb-3">
            <h3 className="text-sm font-medium text-fp-text-1">Throughput</h3>
            <span className="text-xs tabular-nums text-fp-text-3">Last 70 seconds</span>
          </div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
          <div className="mt-2 rounded-fp-lg bg-fp-bg-2 px-2 pt-3 pb-1">
            <p className="px-2 text-xs text-fp-text-3">Crawl rate · offers / min</p>
            <AreaChart data={chartData} options={chartOptions} />
          </div>
        </div>

        <div className="min-w-0 rounded-fp-lg bg-fp-bg-2 px-4 py-3">
          <div className="pb-2">
            <h3 className="text-sm font-medium text-fp-text-1">Market activity</h3>
            <p className="mt-1 text-xs text-fp-text-3">Latest changes across monitored stores</p>
          </div>
          <ol aria-label="Latest market events" className="divide-y divide-fp-border-1">
            {activity.events.slice(0, 4).map((event) => (
              <li
                key={event.id}
                data-market-event-id={event.id}
                className="grid grid-cols-[minmax(0,1fr)_6.75rem] gap-x-3 gap-y-1.5 py-3"
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

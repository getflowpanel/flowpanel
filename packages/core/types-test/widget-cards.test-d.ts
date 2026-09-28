import {
  banner,
  bars,
  custom,
  funnel,
  type KvResult,
  kv,
  type ListRow,
  type ListWidget,
  list,
  type MetricDelta,
  metric,
  stat,
  statGroup,
} from "@flowpanel/core";
import { expectAssignable, expectError, expectNotAssignable, expectType } from "tsd";

expectAssignable<ListRow>({ key: "run-1", text: "Payout failed" });
expectNotAssignable<ListRow>({ key: 1, text: "Payout failed" });
list({ query: async () => [{ key: "run-1", text: "Payout failed", tone: "err" as const }] });

expectAssignable<KvResult>({ value: 3, tone: "err", href: "/admin/runs" });
kv({
  items: [
    {
      label: "Failed",
      value: async () => ({ value: 3, tone: "err" as const, href: "/admin/runs" }),
    },
    { label: "Queued", value: async () => 5, tone: "warn" },
  ],
});
statGroup({
  stats: [{ label: "Errors", value: async () => ({ value: 2, tone: "err" as const }) }],
});
expectError(
  kv({ items: [{ label: "Bad", value: async () => ({ value: 1, tone: "red" as const }) }] }),
);
bars({ query: async () => [{ label: "0–20%", value: 0.45 }], format: "percent", max: 1 });
expectError(bars({ query: async () => [], max: "1" }));
funnel({ query: async () => [{ label: "Visited", value: 9 }], alertDrop: 0.3 });
expectError(funnel({ query: async () => [], alertDrop: "half" }));

expectAssignable<MetricDelta>({
  value: 0.2,
  vs: "vs last week",
  previous: 100,
  goodWhen: "neutral",
});
expectNotAssignable<MetricDelta>({ value: 0.2, vs: "vs last week", goodWhen: "sideways" });

metric("Signups", async () => 1, { compare: true });
metric("Errors", async () => 1, { compare: { goodWhen: "down" } });
metric("Visits", async () => 1, { compare: { against: "weekAgo" } });
expectError(metric("Errors", async () => 1, { compare: { goodWhen: "sideways" } }));
expectError(metric("Visits", async () => 1, { compare: { against: "yesterday" } }));

bars({
  share: true,
  goodWhen: "down",
  query: async () => [{ label: "kwork", value: 3, previous: 1, share: 0.1 }],
});
expectError(bars({ share: "yes", query: async () => [] }));

custom(() => null, {}, { label: "Pipeline", frame: true });

kv({
  items: [
    { label: "About", value: "Hi", long: true, empty: "Not filled" },
    { label: "Resume", value: null, long: { lines: 10 } },
  ],
});
expectError(kv({ items: [{ label: "About", value: "Hi", long: "yes" }] }));
expectError(kv({ items: [{ label: "About", value: "Hi", long: { rows: 3 } }] }));
expectError(kv({ items: [{ label: "About", value: "Hi", empty: 0 }] }));

bars({ compare: true, query: async () => [{ key: "kwork", label: "Kwork", value: 3 }] });
bars({ compare: { against: "weekAgo" }, query: async () => [] });
expectError(bars({ compare: { against: "yesterday" }, query: async () => [] }));

metric("Errors", async () => ({ value: 0.4, volume: 30 }), {
  tones: { warn: 0.3, err: 0.5, min: 20 },
});
stat("Errors", 0.4, { tones: { warn: 0.3, err: 0.5 } });
bars({ tones: { warn: 0.3, err: 0.5 }, query: async () => [] });
expectError(bars({ tones: { warn: 0.3, err: 0.5, goodWhen: "sideways" }, query: async () => [] }));

stat("Runs", 1, { freshness: { at: async () => new Date(), warnAfter: "2h" }, coverage: "sample" });
bars({ coverage: "sample", query: async () => [] });
expectError(stat("Runs", 1, { freshness: { at: async () => new Date(), warnAfter: "2 hours" } }));

expectType<ListWidget>(
  banner({
    query: async () => [
      { text: "Scraper down", tone: "err" as const, count: 3, since: new Date() },
    ],
    limit: 3,
    more: { dashboard: "/system" },
    allClear: "Ничего не горит",
  }),
);
list({ variant: "banner", query: async () => [] });
expectError(list({ variant: "alert", query: async () => [] }));
expectError(banner({ variant: "list", query: async () => [] }));

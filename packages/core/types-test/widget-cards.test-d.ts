import { bars, funnel, type KvResult, kv, type ListRow, list, statGroup } from "@flowpanel/core";
import { expectAssignable, expectError, expectNotAssignable } from "tsd";

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

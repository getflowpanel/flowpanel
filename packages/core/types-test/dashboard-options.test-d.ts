import {
  bars,
  type DashboardFilter,
  type DashboardLink,
  type DateRangeConfig,
  dashboard,
  enumOf,
  metric,
  type RangeLimit,
  type SectionConfig,
  stat,
  table,
  tracker,
  type WidgetContext,
} from "@flowpanel/core";
import { expectAssignable, expectError, expectNotAssignable, expectType } from "tsd";

expectAssignable<DateRangeConfig>({ preset: "last7d", presets: ["today", "yesterday", "last7d"] });
dashboard({
  path: "/parsing",
  label: "Parsing",
  dateRange: { presets: ["today", "last7d", "last30d"] },
  sections: [],
});
expectError(
  dashboard({ path: "/x", label: "X", dateRange: { presets: ["last90d"] }, sections: [] }),
);

expectAssignable<RangeLimit>("30d");
stat("Orders", 1, { maxRange: "30d" });
metric("Orders", async () => 1, { maxRange: "7d" });
expectError(stat("Orders", 1, { maxRange: "30 days" }));

expectAssignable<SectionConfig>({ variant: "strip", widgets: [] });
expectAssignable<SectionConfig>({ variant: "cards", columns: 4, widgets: [] });
expectNotAssignable<SectionConfig>({ variant: "band", widgets: [] });

const byPlatform: DashboardFilter = {
  key: "platform",
  label: "Marketplace",
  options: enumOf({ kwork: "Kwork" }),
};
const byKind: DashboardFilter = {
  key: "kind",
  label: "Kind",
  options: async (_ctx: WidgetContext) => [{ label: "Ban", value: "ban" }],
};
dashboard({
  path: "/parsing",
  label: "Parsing",
  filters: [byPlatform, byKind],
  sections: [
    {
      widgets: [
        bars({ filter: "platform", query: async () => [] }),
        table({ filter: "platform" }),
        tracker({ filter: "platform", rows: async () => [] }),
      ],
    },
  ],
});
declare const ctx: WidgetContext;
expectType<Readonly<Record<string, string>>>(ctx.filters);
expectAssignable<DashboardLink>({ dashboard: "/parsing", filters: { platform: "kwork" } });
expectError<DashboardFilter>({ key: "a", options: [] });

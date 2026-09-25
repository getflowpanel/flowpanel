import {
  type DateRangeConfig,
  dashboard,
  metric,
  type RangeLimit,
  type SectionConfig,
  stat,
} from "@flowpanel/core";
import { expectAssignable, expectError, expectNotAssignable } from "tsd";

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

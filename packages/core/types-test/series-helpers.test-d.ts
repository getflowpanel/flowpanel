import {
  type BarChartOptions,
  type BarRow,
  breakdown,
  enumOf,
  presetRange,
  type SeriesRow,
  series,
  type WidgetContext,
} from "@flowpanel/core";
import { expectAssignable, expectError, expectType } from "tsd";

declare const ctx: WidgetContext;
type Hour = { at: Date; platform: string; orders: number };
declare const rows: Hour[];

expectType<Array<{ date: string; value: number }>>(series(rows, ctx.dateRange, { at: "at" }));
expectType<Array<{ date: string; value: number }>>(
  series(rows, ctx.dateRange, { at: "at", value: "orders" }),
);
expectType<Array<{ date: string; value: number | null }>>(
  series(rows, ctx.dateRange, { at: "at", value: (group) => (group.length ? 1 : null) }),
);
expectType<SeriesRow[]>(series(rows, ctx.dateRange, { at: "at", by: "platform", top: 3 }));
expectError(series(rows, ctx.dateRange, { at: "when" }));
expectError(series(rows, ctx.dateRange, { at: "at", grain: "minute" }));
expectType<BarRow[]>(breakdown(rows, { by: "platform", value: "orders", top: 5 }));
expectType<BarRow[]>(breakdown(rows, { by: "platform", labels: enumOf({ kwork: "Kwork" }) }));
expectError(breakdown(rows, { by: "plattform" }));
expectType<{ from: Date; to: Date }>(presetRange("last7d", ctx));
expectAssignable<BarChartOptions>({ x: "date" });
expectAssignable<BarChartOptions>({ x: "date", labels: { kwork: "Kwork" } });
expectAssignable<BarRow>({ key: "kwork", label: "Kwork", value: 3 });

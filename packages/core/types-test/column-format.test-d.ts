import {
  type ColumnFormat,
  formatDurationValue,
  formatRelativeValue,
  resolveFormatting,
} from "@flowpanel/core";
import { expectAssignable, expectNotAssignable, expectType } from "tsd";

expectAssignable<ColumnFormat>("relative");
expectAssignable<ColumnFormat>({ kind: "date", time: true });
expectAssignable<ColumnFormat>({ kind: "percent", digits: 0, heat: true });
expectAssignable<ColumnFormat>({ kind: "duration", unit: "s" });
expectAssignable<ColumnFormat>({ kind: "boolean", labels: { true: "да", false: "нет" } });
expectAssignable<ColumnFormat>({ kind: "url", label: "Открыть" });
expectNotAssignable<ColumnFormat>({ kind: "duration", unit: "h" });
expectNotAssignable<ColumnFormat>("sparkline");
expectType<string>(formatDurationValue(1000, resolveFormatting()));
expectType<string>(formatRelativeValue(new Date(), resolveFormatting()));

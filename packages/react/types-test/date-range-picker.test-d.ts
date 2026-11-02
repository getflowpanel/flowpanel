import type { DateRangePickerProps } from "@flowpanel/react";
import { expectAssignable, expectNotAssignable } from "tsd";

expectAssignable<DateRangePickerProps>({
  value: {},
  onChange: () => {},
  presets: ["today", "last7d"],
});
expectNotAssignable<DateRangePickerProps>({ value: {}, onChange: () => {}, presets: ["last90d"] });

import type { MetricCardProps } from "@flowpanel/react";
import { expectAssignable, expectNotAssignable } from "tsd";

expectAssignable<MetricCardProps>({
  label: "Conversion",
  value: 0.43,
  format: "percent",
  delta: { value: 0.075, vs: "prev", previous: 0.4 },
  goodWhen: "neutral",
  previousLabel: "было {value}",
  pointsLabel: "{value} п.п.",
});
expectNotAssignable<MetricCardProps>({ label: "Visits", value: 1, previousLabel: 5 });

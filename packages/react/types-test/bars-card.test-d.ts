import type { BarsCardProps } from "@flowpanel/react";
import { expectAssignable, expectNotAssignable } from "tsd";

expectAssignable<BarsCardProps>({
  rows: [{ label: "kwork", value: 3, previous: 1, share: 0.3 }],
  share: true,
  goodWhen: "down",
});
expectNotAssignable<BarsCardProps>({ rows: [], goodWhen: "sideways" });

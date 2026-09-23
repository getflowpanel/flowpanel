import type {
  BooleanCellProps,
  HeatCellProps,
  RelativeTimeCellProps,
  UrlCellProps,
} from "@flowpanel/react";
import { expectAssignable, expectNotAssignable } from "tsd";

expectAssignable<BooleanCellProps>({ value: true });
expectAssignable<HeatCellProps>({ level: 2, text: "42%" });
expectAssignable<RelativeTimeCellProps>({ value: new Date() });
expectAssignable<RelativeTimeCellProps>({ value: "2026-09-23T11:55:00Z" });
expectNotAssignable<UrlCellProps>({ href: "/admin/order/7" });

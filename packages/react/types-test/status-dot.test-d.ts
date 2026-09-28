import {
  type StatusDot,
  type StatusTone,
  type Tone,
  toneFillClass,
  toneTextClass,
} from "@flowpanel/react";
import { expectAssignable, expectNotAssignable, expectType } from "tsd";

expectAssignable<StatusTone>("info");
expectAssignable<StatusTone>("accent");
expectNotAssignable<StatusTone>("danger");
expectAssignable<Parameters<typeof StatusDot>[0]>({ tone: "info" });
expectType<Record<Tone, string>>(toneTextClass);
expectType<Record<Tone, string>>(toneFillClass);
